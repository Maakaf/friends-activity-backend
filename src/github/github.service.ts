import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Octokit } from '@octokit/rest';
import { paginateRest } from '@octokit/plugin-paginate-rest';
import { insertBronze, BronzeRow } from './bronze-saver';

const MyOctokit = Octokit.plugin(paginateRest);
const ISSUE_NUM_RE = /\/issues\/(\d+)$/;
const PR_NUM_RE    = /\/pulls\/(\d+)$/;

@Injectable()
export class GithubService {
  private readonly octokit = new MyOctokit({
    auth: process.env.GITHUB_TOKEN || (() => { throw new Error('GITHUB_TOKEN environment variable is required') })(),
    userAgent: 'friends-activity-backend/1.0',
    request: { headers: { accept: 'application/vnd.github+json' } },
  });

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // --------- Helpers ----------
  private toSet(csv?: string) {
    return new Set((csv ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean));
  }

  private isoNow(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  private async listRepos(org: string) {
    return this.octokit.paginate(
      this.octokit.repos.listForOrg,
      { org, type: 'all', per_page: 100 },
      (r) => r.data,
    );
  }

  /** Build { issue/PR number -> id } for one repo (since watermark) */
  private async buildNumberToIdMap(owner: string, repo: string, sinceIso: string) {
    const map = new Map<string, string>();
    const items = await this.octokit.paginate(
      this.octokit.issues.listForRepo,
      { owner, repo, state: 'all', per_page: 100, since: sinceIso },
      (r) => r.data,
    );
    for (const it of items) {
      const num = (it as any).number;
      const id  = (it as any).id;
      if (num != null && id != null) map.set(String(num), String(id));
    }
    return map;
  }

  private async resolveIssueParentId(
    owner: string, repo: string, comment: any, numberToId: Map<string, string>
  ) {
    const issueUrl = comment.issue_url ?? '';
    const m = issueUrl.match(ISSUE_NUM_RE);
    if (!m) return null;
    const num = m[1];
    const cached = numberToId.get(num);
    if (cached) return cached;

    try {
      const { data } = await this.octokit.issues.get({ owner, repo, issue_number: Number(num) });
      const id = String((data as any).id);
      numberToId.set(num, id);
      return id;
    } catch {
      return null;
    }
  }

  private async resolvePRParentId(
    owner: string, repo: string, comment: any, numberToId: Map<string, string>
  ) {
    const prUrl = comment.pull_request_url ?? '';
    const m = prUrl.match(PR_NUM_RE);
    if (!m) return null;
    const num = m[1];
    const cached = numberToId.get(num);
    if (cached) return cached;

    try {
      const { data } = await this.octokit.pulls.get({ owner, repo, pull_number: Number(num) });
      const id = String((data as any).id);
      numberToId.set(num, id);
      return id;
    } catch {
      return null;
    }
  }

  // --------- Ingestors (mirror your Python) ---------

  /** Issues + PRs created by users (uses ?creator=login). */
  private async ingestIssuesAndPRsByCreator(
    owner: string, repo: string, repoId: number | undefined, isPrivate: boolean | undefined,
    users: Set<string>, sinceIso: string,
  ) {
    const logins = users.size ? [...users] : [undefined];
    const rows: BronzeRow[] = [];

    for (const login of logins) {
      const pages = await this.octokit.paginate(
        this.octokit.issues.listForRepo,
        { owner, repo, state: 'all', per_page: 100, since: sinceIso, ...(login ? { creator: login } : {}) } as any,
        (r) => r.data,
      );

      for (const it of pages) {
        const isPR = (it as any).pull_request != null;
        const event_type = isPR ? 'pull_request' : 'issue';

        const row: BronzeRow = {
          event_ulid: `${event_type}:${(it as any).id}`,
          provider: 'github',
          event_type,
          provider_event_id: String((it as any).id),
          actor_user_node: (it as any).user?.id ? String((it as any).user.id) : null,
          repo_node: repoId != null ? String(repoId) : null,
          target_node: String((it as any).id), // parent for itself
          created_at: (it as any).created_at ?? null,
          is_private: isPrivate ?? null,
          raw_payload: it,
        };
        rows.push(row);
      }
    }

    for (const row of rows) {
      await insertBronze(this.ds, row);
    }
  }

  /** Issue comments (filter client-side by commenter; resolve ParentID from issue_url). */
  private async ingestIssueComments(
    owner: string, repo: string, repoId: number | undefined, isPrivate: boolean | undefined,
    users: Set<string>, sinceIso: string, numberToId: Map<string, string>,
  ) {
    const comments = await this.octokit.paginate(
      this.octokit.issues.listCommentsForRepo,
      { owner, repo, per_page: 100, since: sinceIso },
      (r) => r.data,
    );

    for (const c of comments) {
      const login = (c as any).user?.login;
      if (users.size && login && !users.has(login)) continue;

      try {
        const parentId = await this.resolveIssueParentId(owner, repo, c, numberToId);

        const row: BronzeRow = {
          event_ulid: `issue_comment:${(c as any).id}`,
          provider: 'github',
          event_type: 'issue_comment',
          provider_event_id: String((c as any).id),
          actor_user_node: (c as any).user?.id ? String((c as any).user.id) : null,
          repo_node: repoId != null ? String(repoId) : null,
          target_node: parentId, // <-- Parent Issue/PR ID
          created_at: (c as any).created_at ?? null,
          is_private: isPrivate ?? null,
          raw_payload: c,
        };
        await insertBronze(this.ds, row);
      } catch {
        // Continue with remaining comments if one fails
      }
    }
  }

  /** PR review comments (inline) — resolve ParentID from pull_request_url. */
  private async ingestPRReviewComments(
    owner: string, repo: string, repoId: number | undefined, isPrivate: boolean | undefined,
    users: Set<string>, sinceIso: string, numberToId: Map<string, string>,
  ) {
    const comments = await this.octokit.paginate(
      this.octokit.pulls.listReviewCommentsForRepo,
      { owner, repo, per_page: 100, since: sinceIso },
      (r) => r.data,
    );

    for (const c of comments) {
      const login = (c as any).user?.login;
      if (users.size && login && !users.has(login)) continue;

      const parentId = await this.resolvePRParentId(owner, repo, c, numberToId);

      const row: BronzeRow = {
        event_ulid: `pr_review_comment:${(c as any).id}`,
        provider: 'github',
        event_type: 'pr_review_comment',
        provider_event_id: String((c as any).id),
        actor_user_node: (c as any).user?.id ? String((c as any).user.id) : null,
        repo_node: repoId != null ? String(repoId) : null,
        target_node: parentId, // <-- Parent PR ID
        created_at: (c as any).created_at ?? null,
        is_private: isPrivate ?? null,
        raw_payload: c,
      };
      await insertBronze(this.ds, row);
    }
  }

  /** Commits — best with author=<login>; falls back to everyone since. */
  private async ingestCommitsForUsers(
    owner: string, repo: string, repoId: number | undefined, isPrivate: boolean | undefined,
    users: Set<string>, sinceIso: string, untilIso?: string,
  ) {
    const who = users.size ? [...users] : [undefined];

    for (const login of who) {
      const params: any = { owner, repo, per_page: 100, since: sinceIso };
      if (untilIso) params.until = untilIso;
      if (login) params.author = login;

      const commits = await this.octokit.paginate(
        this.octokit.repos.listCommits,
        params,
        (r) => r.data,
      );

      for (const c of commits) {
        const authorLogin = (c as any).author?.login;
        if (users.size && authorLogin && !users.has(authorLogin)) continue;

        const row: BronzeRow = {
          event_ulid: `commit:${(c as any).sha}`,     // optionally include repo id: `commit:${repoId}:${sha}`
          provider: 'github',
          event_type: 'commit',
          provider_event_id: String((c as any).sha),
          actor_user_node: (c as any).author?.id ? String((c as any).author.id) : null,
          repo_node: repoId != null ? String(repoId) : null,
          target_node: null, // no push linkage here (can be added via Events pipeline later)
          created_at: (c as any).commit?.committer?.date ?? null,
          is_private: isPrivate ?? null,
          raw_payload: c,
        };
        await insertBronze(this.ds, row);
      }
    }
  }

  // --------- Orchestrator (entry point) ---------

  /**
   * Mirrors your Python driver:
   *  - lists org repos
   *  - builds number->id map for parent resolution
   *  - ingests PRs, Issues, Issue comments, PR review comments, Commits
   */
  async ingestOrgForUsers(org: string, usersCsv = '', sinceIso?: string, untilIso?: string) {
    const users = this.toSet(usersCsv);
    const since = sinceIso ?? new Date(Date.now() - 7 * 86400e3).toISOString();

    const repos = await this.listRepos(org);
    for (const r of repos) {
      try {
        const owner = r.owner?.login;
        const name  = r.name;
        const rid   = r.id as number | undefined;
        const priv  = r.private as boolean | undefined;

        // Build cache so comments can resolve parent Issue/PR id
        const numberToId = await this.buildNumberToIdMap(owner, name, since);

        await this.ingestIssuesAndPRsByCreator(owner, name, rid, priv, users, since);
        await this.ingestIssueComments(owner, name, rid, priv, users, since, numberToId);
        await this.ingestPRReviewComments(owner, name, rid, priv, users, since, numberToId);
        await this.ingestCommitsForUsers(owner, name, rid, priv, users, since, untilIso);
      } catch {
        // Continue with remaining repositories if one fails
      }
    }

    return { org, users: [...users], since, until: untilIso ?? null, repos: repos.length };
  }
}
