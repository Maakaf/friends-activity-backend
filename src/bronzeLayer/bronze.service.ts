import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { insertBronze, BronzeRow } from './bronze-saver.js';
import { GithubClientService } from './github-client.service.js';

const ISSUE_NUM_RE = /\/issues\/(\d+)$/;
const PR_NUM_RE    = /\/pulls\/(\d+)$/;

@Injectable()
export class BronzeService {
  private readonly logger = new Logger(BronzeService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly githubClient: GithubClientService,
  ) {}

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

  private isoDaysAgo(days: number): string {
    return new Date(Date.now() - days * 86400e3).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  private repoKey(owner: string, repo: string) {
    return `${owner}/${repo}`;
  }

  private parseOwnerRepoFromRepoUrl(repoUrl?: string) {
    if (!repoUrl) return null;
    const parts = repoUrl.split('/').slice(-2);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  }

  private parseOwnerRepoFromHtmlUrl(htmlUrl?: string) {
    if (!htmlUrl) return null;
    const m = htmlUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)/);
    if (!m) return null;
    return { owner: m[1], repo: m[2] };
  }

  private async fetchRepoMeta(owner: string, repo: string) {
    const data = await this.githubClient.reposGet(owner, repo);
    return {
      owner,
      name: repo,
      id: Number((data as any).id),
      private: Boolean((data as any).private),
    };
  }

  private async listRepos(org: string) {
    return this.githubClient.listRepos(org);
  }

  /** Build { issue/PR number -> id } for one repo (since watermark) */
  private async buildNumberToIdMap(owner: string, repo: string, sinceIso: string) {
    const map = new Map<string, string>();
    const items = await this.githubClient.listIssuesForRepo({
      owner,
      repo,
      state: 'all',
      since: sinceIso,
    });
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
      const data = await this.githubClient.getIssue({
        owner,
        repo,
        issue_number: Number(num),
      });
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
      const data = await this.githubClient.getPull({
        owner,
        repo,
        pull_number: Number(num),
      });
      const id = String((data as any).id);
      numberToId.set(num, id);
      return id;
    } catch {
      return null;
    }
  }

  // =======================
  // repo discovery
  // =======================

  private async discoverReposForUser(login: string, sinceIso: string) {
    const found = new Map<string, { owner: string; repo: string }>();

    // A) Issues/PRs the user is involved in
    const qIssues = `involves:${login} created:>=${sinceIso}`;
    const issues = await this.githubClient.searchIssuesAndPRs(qIssues);

    for (const it of issues as any[]) {
      const parsed = this.parseOwnerRepoFromRepoUrl(it.repository_url);
      if (parsed) found.set(this.repoKey(parsed.owner, parsed.repo), parsed);
    }

    // B) Commits authored by the user
    const qCommits = `author:${login} committer-date:>=${sinceIso}`;
    const commits = await this.githubClient.searchCommits(qCommits);

    for (const c of commits as any[]) {
      const full = c.repository?.full_name as string | undefined;
      if (full && full.includes('/')) {
        const [owner, repo] = full.split('/');
        found.set(this.repoKey(owner, repo), { owner, repo });
      } else {
        const parsed = this.parseOwnerRepoFromHtmlUrl(c.html_url);
        if (parsed) found.set(this.repoKey(parsed.owner, parsed.repo), parsed);
      }
    }

    return Array.from(found.values());
  }

  private async buildRepoUsersMap(allUsers: Set<string>, sinceIso: string) {
    const map = new Map<string, { owner: string; repo: string; users: Set<string> }>();

    const userRepoPromises = Array.from(allUsers).map(async (login) => {
      const repos = await this.discoverReposForUser(login, sinceIso);
      return { login, repos };
    });

    const userRepoResults = await Promise.all(userRepoPromises);

    for (const { login, repos } of userRepoResults) {
      for (const r of repos) {
        const key = this.repoKey(r.owner, r.repo);
        if (!map.has(key)) map.set(key, { owner: r.owner, repo: r.repo, users: new Set<string>() });
        map.get(key)!.users.add(login);
      }
    }
    return map;
  }

  // =======================
  // Ingestors
  // =======================

  private async ingestIssuesAndPRsByCreator(
    owner: string, repo: string, repoId: number | undefined, isPrivate: boolean | undefined,
    users: Set<string>, sinceIso: string,
  ) {
    const logins = users.size ? [...users] : [undefined];
    const rows: BronzeRow[] = [];

    for (const login of logins) {
      const pages = await this.githubClient.listIssuesForRepo({
        owner,
        repo,
        state: 'all',
        since: sinceIso,
        ...(login ? { creator: login } : {}),
      });

      for (const it of pages) {
        const isPR = (it as any).pull_request != null;
        const event_type = isPR ? 'pull_request' : 'issue';

        const row: BronzeRow = {
          event_ulid: `${event_type}:${(it as any).id}`,
          provider: 'bronzeLayer',
          event_type,
          provider_event_id: String((it as any).id),
          actor_user_node: (it as any).user?.id ? String((it as any).user.id) : null,
          repo_node: repoId != null ? String(repoId) : null,
          target_node: String((it as any).id),
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

  private async ingestIssueComments(
    owner: string, repo: string, repoId: number | undefined, isPrivate: boolean | undefined,
    users: Set<string>, sinceIso: string, numberToId: Map<string, string>,
  ) {
    const comments = await this.githubClient.listCommentsForRepo({
      owner,
      repo,
      since: sinceIso,
    });

    for (const c of comments) {
      const login = (c as any).user?.login;
      if (users.size && login && !users.has(login)) continue;

      try {
        const parentId = await this.resolveIssueParentId(owner, repo, c, numberToId);

        const row: BronzeRow = {
          event_ulid: `issue_comment:${(c as any).id}`,
          provider: 'bronzeLayer',
          event_type: 'issue_comment',
          provider_event_id: String((c as any).id),
          actor_user_node: (c as any).user?.id ? String((c as any).user.id) : null,
          repo_node: repoId != null ? String(repoId) : null,
          target_node: parentId,
          created_at: (c as any).created_at ?? null,
          is_private: isPrivate ?? null,
          raw_payload: c,
        };
        await insertBronze(this.ds, row);
      } catch {
        // continue with remaining comments if one fails
      }
    }
  }

  private async ingestPRReviewComments(
    owner: string, repo: string, repoId: number | undefined, isPrivate: boolean | undefined,
    users: Set<string>, sinceIso: string, numberToId: Map<string, string>,
  ) {
    const comments = await this.githubClient.listReviewCommentsForRepo({
      owner,
      repo,
      since: sinceIso,
    });

    for (const c of comments) {
      const login = (c as any).user?.login;
      if (users.size && login && !users.has(login)) continue;

      const parentId = await this.resolvePRParentId(owner, repo, c, numberToId);

      const row: BronzeRow = {
        event_ulid: `pr_review_comment:${(c as any).id}`,
        provider: 'bronzeLayer',
        event_type: 'pr_review_comment',
        provider_event_id: String((c as any).id),
        actor_user_node: (c as any).user?.id ? String((c as any).user.id) : null,
        repo_node: repoId != null ? String(repoId) : null,
        target_node: parentId,
        created_at: (c as any).created_at ?? null,
        is_private: isPrivate ?? null,
        raw_payload: c,
      };
      await insertBronze(this.ds, row);
    }
  }

  private async ingestCommitsForUsers(
    owner: string, repo: string, repoId: number | undefined, isPrivate: boolean | undefined,
    users: Set<string>, sinceIso: string, untilIso?: string,
  ) {
    const who = users.size ? [...users] : [undefined];

    for (const login of who) {
      const params: any = { since: sinceIso };
      if (untilIso) params.until = untilIso;
      if (login) params.author = login;

      const commits = await this.githubClient.listCommits(owner, repo, params);

      for (const c of commits) {
        const authorLogin = (c as any).author?.login;
        if (users.size && authorLogin && !users.has(authorLogin)) continue;

        const row: BronzeRow = {
          event_ulid: `commit:${(c as any).sha}`,
          provider: 'bronzeLayer',
          event_type: 'commit',
          provider_event_id: String((c as any).sha),
          actor_user_node: (c as any).author?.id ? String((c as any).author.id) : null,
          repo_node: repoId != null ? String(repoId) : null,
          target_node: null,
          created_at: (c as any).commit?.committer?.date ?? null,
          is_private: isPrivate ?? null,
          raw_payload: c,
        };
        await insertBronze(this.ds, row);
      }
    }
  }

  // =======================
  // orchestrators
  // =======================

  async ingestEachUserInTheirRepos(
    usersArray: string[],
    sinceIso?: string,
    untilIso?: string,
  ) {
    const users = new Set(usersArray.map((s) => s.trim()).filter(Boolean));
    if (!users.size) throw new Error('users list is required');

    const since = sinceIso ?? this.isoDaysAgo(180);
    const until = untilIso ?? this.isoNow();

    const repoUsers = await this.buildRepoUsersMap(users, since);

    let ingestedRepos = 0;
    for (const { owner, repo, users: usersForRepo } of repoUsers.values()) {
      let meta: { owner: string; name: string; id?: number; private?: boolean } | null = null;
      try {
        const m = await this.fetchRepoMeta(owner, repo);
        meta = { owner: m.owner, name: m.name, id: m.id, private: m.private };
      } catch {
        continue;
      }

      const numberToId = await this.buildNumberToIdMap(meta.owner, meta.name, since);
      await this.ingestIssuesAndPRsByCreator(meta.owner, meta.name, meta.id, meta.private, usersForRepo, since);
      await this.ingestIssueComments(meta.owner, meta.name, meta.id, meta.private, usersForRepo, since, numberToId);
      await this.ingestPRReviewComments(meta.owner, meta.name, meta.id, meta.private, usersForRepo, since, numberToId);
      await this.ingestCommitsForUsers(meta.owner, meta.name, meta.id, meta.private, usersForRepo, since, until);
      ingestedRepos++;
    }

    return { mode: 'per-user-repos', users: [...users], repos: ingestedRepos, since, until };
  }

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

        const numberToId = await this.buildNumberToIdMap(owner, name, since);

        await this.ingestIssuesAndPRsByCreator(owner, name, rid, priv, users, since);
        await this.ingestIssueComments(owner, name, rid, priv, users, since, numberToId);
        await this.ingestPRReviewComments(owner, name, rid, priv, users, since, numberToId);
        await this.ingestCommitsForUsers(owner, name, rid, priv, users, since, untilIso);
      } catch (err) {
        this.logger.warn(
          `Failed to ingest repo ${r.full_name || `${r.owner.login}/${r.name}`}: ${err.message}`,
        );
        continue; // move on to next repo      }
    }

    return { org, users: [...users], since, until: untilIso ?? null, repos: repos.length };
  }
}
}