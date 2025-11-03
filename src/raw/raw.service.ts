import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { insertBronze, BronzeRow, upsertBronzeUser, upsertBronzeRepo } from './raw-saver.js';
import { RawMemoryStore, BronzeEventsRow, BronzeUsersRow, BronzeReposRow } from './raw-memory.store.js';
import { GITHUB_CLIENT } from './github-client.token.js';
import type { GithubClient, GithubCommitDTO, GithubIssueCommentDTO, GithubPRReviewCommentDTO, GithubIssueOrPRDTO, GithubSearchCommitDTO, GithubSearchIssueOrPRDTO } from './github-client-interface.js';

const ISSUE_NUM_RE = /\/issues\/(\d+)$/;
const PR_NUM_RE = /\/pulls\/(\d+)$/;

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @Inject(RawMemoryStore) private readonly mem: RawMemoryStore,
    @Inject(GITHUB_CLIENT) private readonly github: GithubClient,
  ) { }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    operation: string,
    maxRetries = 5,
    baseDelay = 2000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const isRateLimit = error?.status === 403 && error?.message?.includes('rate limit');
        const isServerError = error?.status >= 500; // 502, 504, etc.

        if (attempt === maxRetries) {
          if (isServerError) {
            this.logger.warn(`⚠️ ${operation} failed with server error after ${maxRetries} attempts, skipping: ${error?.status}`);
            return [] as any; // Return empty array for pagination failures
          }
          this.logger.warn(`❌ ${operation} failed after ${maxRetries} attempts: ${error?.message}`);
          throw error;
        }

        if (isRateLimit || isServerError) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // exponential backoff
          this.logger.warn(`⏳ ${operation} ${isServerError ? 'server error' : 'rate limited'}, attempt ${attempt}/${maxRetries}, waiting ${delay}ms`);
          await this.sleep(delay);
        } else {
          // For non-rate-limit errors, shorter delay
          await this.sleep(1000);
        }
      }
    }

    throw lastError;
  }

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

  private isoHoursAgo(hours: number): string {
    return new Date(Date.now() - hours * 3600e3).toISOString().replace(/\.\d{3}Z$/, 'Z');
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
  // Dual write helper
  private async writeEventBoth(row: Omit<BronzeRow, 'received_at'> & { received_at?: string | null; }) {
    const fullRow: BronzeRow = {
      ...row,
      received_at: row.received_at ?? null,
    };
    await insertBronze(this.ds, fullRow);
    const memRow: BronzeEventsRow = { ...fullRow };
    this.mem.upsertEvent(memRow);
  }

  private async fetchRepoMeta(owner: string, repo: string) {
    this.logger.log(`Fetching repo metadata: ${owner}/${repo}`);
    const meta = await this.github.getRepo({ owner, repo });
    this.logger.log(`✅ Repo metadata fetched: ${owner}/${repo}`);

    const repo_node = String(meta.id);
    const full_name = meta.fullName ?? `${owner}/${repo}`;
    const owner_login = meta.ownerLogin ?? owner;
    const name = meta.name ?? repo;
    const is_private = Boolean(meta.private);

    try {
      // DB write
      await upsertBronzeRepo(this.ds, {
        repo_node,
        full_name,
        owner_login,
        name,
        is_private,
        raw_payload: meta.raw,
      });

      // Memory write
      const memRepo: BronzeReposRow = {
        repo_node,
        provider: 'github',
        full_name,
        owner_login,
        name,
        is_private,
        fetched_at: null,
        raw_payload: meta.raw,
      };
      this.mem.upsertRepo(memRepo);
    } catch (error) {
      this.logger.warn(`❌ Failed to save repo metadata: ${owner}/${repo} - ${error}`);
    }

    return {
      owner,
      name: repo,
      id: Number(meta.id),
      private: is_private,
    };
  }

  private async fetchMultipleReposMeta(repos: Array<{ owner: string, repo: string; }>) {
    const BATCH_SIZE = 3; // Conservative to avoid rate limits
    const results = new Map<string, { owner: string; name: string; id?: number; private?: boolean; } | null>();

    this.logger.log(`Fetching metadata for ${repos.length} repos in batches of ${BATCH_SIZE}`);

    for (let i = 0; i < repos.length; i += BATCH_SIZE) {
      const batch = repos.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async ({ owner, repo }) => {
        try {
          const meta = await this.retryWithBackoff(
            () => this.fetchRepoMeta(owner, repo),
            `Repo metadata ${owner}/${repo}`
          );
          return { key: this.repoKey(owner, repo), meta };
        } catch (error) {
          this.logger.warn(`❌ Failed to fetch repo metadata for ${owner}/${repo}: ${error}`);
          return { key: this.repoKey(owner, repo), meta: null };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.set(result.value.key, result.value.meta);
        }
      }

      // Small delay between batches to be respectful
      if (i + BATCH_SIZE < repos.length) {
        await this.sleep(500);
      }
    }

    return results;
  }

  private async checkUsersInGoldProfile(userLogins: string[]): Promise<Set<string>> {
    if (!userLogins.length) return new Set();

    const result = await this.ds.query(
      'SELECT login FROM gold.user_profile WHERE login = ANY($1)',
      [userLogins]
    );

    return new Set(result.map((row: any) => row.login));
  }

  private async getAllDbUsers(): Promise<string[]> {
    const result = await this.ds.query('SELECT login FROM gold.user_profile');
    return result.map((row: any) => row.login);
  }

  private findExcludedUsers(allDbUsers: string[], inputUsers: string[]): string[] {
    return allDbUsers.filter(login => !inputUsers.includes(login));
  }

  private async removeSpecificUsers(usersToRemove: string[]) {
    if (!usersToRemove.length) return { eventsDeleted: 0, activitiesDeleted: 0 };

    this.logger.log(`🗑️ Removing ${usersToRemove.length} users from database: ${usersToRemove.join(', ')}`);

    // Get user_nodes from bronze.github_users for proper cleanup
    const userNodes = await this.ds.query(
      'SELECT login, user_node FROM bronze.github_users WHERE login = ANY($1)',
      [usersToRemove]
    );
    const userNodeMap = new Map(userNodes.map((row: any) => [row.login, row.user_node]));
    const userNodeValues = Array.from(userNodeMap.values()).filter(Boolean);

    let eventsDeleted = 0;
    let activitiesDeleted = 0;

    // Remove from Gold layer
    await this.ds.query(
      'DELETE FROM gold.user_profile WHERE login = ANY($1)',
      [usersToRemove]
    );

    if (userNodeValues.length > 0) {
      const activitiesResult = await this.ds.query(
        'DELETE FROM gold.user_activity WHERE user_id = ANY($1) RETURNING *',
        [userNodeValues]
      );
      activitiesDeleted = activitiesResult.length;

      const eventsResult = await this.ds.query(
        'DELETE FROM bronze.github_events WHERE actor_user_node = ANY($1) RETURNING *',
        [userNodeValues]
      );
      eventsDeleted = eventsResult.length;
    }

    // Remove from Bronze layer
    await this.ds.query(
      'DELETE FROM bronze.github_users WHERE login = ANY($1)',
      [usersToRemove]
    );

    // Remove from memory store
    for (const login of usersToRemove) {
      const userNode = userNodeMap.get(login);
      if (userNode && typeof userNode === 'string') {
        this.mem.removeUserData(userNode);
      }
    }

    this.logger.log(`✅ Removed ${usersToRemove.length} users from all layers`);
    return { eventsDeleted, activitiesDeleted };
  }

  async removeUsers(users: string[]) {
    const inputUsers = users.map(s => s.trim()).filter(Boolean);
    if (!inputUsers.length) {
      throw new Error('Users list cannot be empty');
    }

    // Check which users exist in DB
    const existingUsers = await this.checkUsersInGoldProfile(inputUsers);
    const existingUsersList = Array.from(existingUsers);
    const notFoundUsers = inputUsers.filter(user => !existingUsers.has(user));

    const removedUsers: string[] = [];
    const failedUsers: string[] = [];

    // Process each user individually for proper failure tracking
    for (const user of existingUsersList) {
      try {
        // Get user_node for this specific user
        const userNodeResult = await this.ds.query(
          'SELECT user_node FROM bronze.github_users WHERE login = $1',
          [user]
        );

        if (userNodeResult.length === 0) {
          this.logger.warn(`⚠️ User ${user} not found in bronze.github_users, skipping`);
          continue;
        }

        const userNode = userNodeResult[0].user_node;

        // Delete events for this user
        await this.ds.query(
          'DELETE FROM bronze.github_events WHERE actor_user_node = $1',
          [userNode]
        );

        // Delete activities for this user
        await this.ds.query(
          'DELETE FROM gold.user_activity WHERE user_id = $1',
          [userNode]
        );

        // Delete from gold.user_profile
        await this.ds.query(
          'DELETE FROM gold.user_profile WHERE login = $1',
          [user]
        );

        // Delete from bronze.github_users
        await this.ds.query(
          'DELETE FROM bronze.github_users WHERE login = $1',
          [user]
        );

        // Remove from memory store
        this.mem.removeUserData(userNode);

        // Track successful removal
        removedUsers.push(user);

        this.logger.log(`✅ Successfully removed user ${user}`);

      } catch (error) {
        this.logger.warn(`❌ Failed to remove user ${user}: ${error}`);
        failedUsers.push(user);
      }
    }

    return {
      message: 'User removal completed',
      summary: {
        requested: inputUsers.length,
        removed: removedUsers.length,
        notFound: notFoundUsers.length,
        failed: failedUsers.length
      },
      removedUsers,
      notFoundUsers,
      failedUsers
    };
  }

  private async removeUsersNotInInputList(inputUsers: string[]) {
    if (!inputUsers.length) return;

    // Get all users currently in gold.user_profile
    const allDbUsers = await this.ds.query('SELECT login FROM gold.user_profile');
    const dbUserLogins = allDbUsers.map((row: any) => row.login);

    // Find users in DB but not in input list
    const usersToRemove = dbUserLogins.filter((login: string) => !inputUsers.includes(login));

    if (!usersToRemove.length) {
      this.logger.log('🔍 No users to remove from database');
      return;
    }

    await this.removeSpecificUsers(usersToRemove);
  }

  private async upsertUserProfilesToBronze(logins: string[]) {
    const unique = Array.from(new Set(logins.map(s => s.trim()).filter(Boolean)));
    this.logger.log(`Fetching user profiles: ${unique.join(', ')}`);
    for (const login of unique) {
      try {
        this.logger.log(`Fetching user: ${login}`);
        const data = await this.github.getUserByUsername({ username: login });
        const user_node = String(data.id);
        const userLogin = data.login ?? login;
        const name = (data as any).name ?? null;

        // DB write
        await upsertBronzeUser(this.ds, {
          user_node,
          login: userLogin,
          name,
          raw_payload: data.raw,
        });

        // Memory write
        const memUser: BronzeUsersRow = {
          user_node,
          provider: 'github',
          login: userLogin,
          name,
          fetched_at: null,
          raw_payload: data,
        };
        this.mem.upsertUser(memUser);
        this.logger.log(`✅ User profile saved: ${login}`);
      } catch (error) {
        this.logger.warn(`❌ Failed to fetch user: ${login} - ${error}`);
      }
    }
  }



  /** Build { issue/PR number -> id } for one repo (since watermark) */
  private async buildNumberToIdMap(owner: string, repo: string, sinceIso: string) {
    const map = new Map<string, string>();
    const items = await this.github.listIssuesAndPullsForRepo({ owner, repo, sinceIso });
    for (const item of items) {
      const num = item.number;
      const id = item.id;
      if (num != null && id != null) map.set(String(num), String(id));
    }
    return map;
  }

  private async resolveIssueParentId(
    owner: string, repo: string, comment: any, numberToId: Map<string, string>
  ) {
    const issueUrl = (comment as GithubIssueCommentDTO).issueUrl ?? '';
    const m = issueUrl.match(ISSUE_NUM_RE);
    if (!m) return null;
    const num = m[1];
    const cached = numberToId.get(num);
    if (cached) return cached;

    try {
      const issue = await this.github.getIssue({ owner, repo, issueNumber: Number(num) });
      const id = String(issue.id);
      numberToId.set(num, id);
      return id;
    } catch (error) {
      this.logger.warn(`❌ Failed to resolve issue parent ID for ${owner}/${repo}#${num}: ${error}`);
      return null;
    }
  }

  private async resolvePRParentId(
    owner: string, repo: string, comment: any, numberToId: Map<string, string>
  ) {
    const prUrl = (comment as GithubPRReviewCommentDTO).pullRequestUrl ?? '';
    const m = prUrl.match(PR_NUM_RE);
    if (!m) return null;
    const num = m[1];
    const cached = numberToId.get(num);
    if (cached) return cached;

    try {
      const pr = await this.github.getPull({ owner, repo, pullNumber: Number(num) });
      const id = String(pr.id);
      numberToId.set(num, id);
      return id;
    } catch (error) {
      this.logger.warn(`❌ Failed to resolve PR parent ID for ${owner}/${repo}#${num}: ${error}`);
      return null;
    }
  }

  private async ingestCommitsForPR(
    owner: string,
    repo: string,
    repoId: number | undefined,
    isPrivate: boolean | undefined,
    prNumber: number,
    prId: string,
    users: Set<string>
  ) {
    const commits = await this.retryWithBackoff(
      () => this.github.listCommitsForPull({ owner, repo, pullNumber: prNumber }),
      `PR commits for ${owner}/${repo}#${prNumber}`
    );

    for (const c of commits) {
      const authorLogin = c.authorLogin;
      if (users.size && (!authorLogin || !users.has(authorLogin))) continue;

      const row: BronzeRow = {
        event_ulid: `commit:${c.sha}`,
        provider: 'github',
        event_type: 'commit',
        provider_event_id: String(c.sha),
        actor_user_node: c.authorId ? String(c.authorId) : null,
        repo_node: repoId != null ? String(repoId) : null,
        target_node: prId,
        created_at: c.committedDate ?? null,
        is_private: isPrivate ?? null,
        raw_payload: c.raw,
      };
      await this.writeEventBoth(row);
    }
  }

  // =======================
  // repo discovery
  // =======================

  /** Repos a single user has activity in (issues/PRs/comments + commits) since `sinceIso`. */
  private async discoverReposForUser(login: string, sinceIso: string) {
    const found = new Map<string, { owner: string; repo: string; }>();
    this.logger.log(`Discovering repos for user: ${login}`);

    // A) Issues/PRs the user is involved in (author/comment/assignee/mentioned)
    const qIssues = `involves:${login} created:>=${sinceIso}`;
    try {
      this.logger.log(`Searching issues/PRs: ${qIssues}`);
      const issues = await this.retryWithBackoff(
        () => this.github.searchIssuesAndPulls({ q: qIssues }),
        `Issues/PRs search for ${login}`
      );
      this.logger.log(`✅ Found ${issues.length} issues/PRs for ${login}`);

      for (const it of issues as GithubSearchIssueOrPRDTO[]) {
        const parsed = this.parseOwnerRepoFromRepoUrl(it.repositoryUrl || undefined);
        if (parsed) found.set(this.repoKey(parsed.owner, parsed.repo), parsed);
      }
    } catch (error) {
      this.logger.warn(`❌ Failed to search issues/PRs for ${login}: ${error}`);
    }

    // B) Commits authored by the user
    const qCommits = `author:${login} committer-date:>=${sinceIso}`;
    try {
      this.logger.log(`Searching commits: ${qCommits}`);
      const commits = await this.retryWithBackoff(
        () => this.github.searchCommits({ q: qCommits }),
        `Commits search for ${login}`,
        5,
        5000
      );
      this.logger.log(`✅ Found ${commits.length} commits for ${login}`);

      for (const c of commits as GithubSearchCommitDTO[]) {
        const full = c.repositoryFullName || undefined;
        if (full && full.includes('/')) {
          const [owner, repo] = full.split('/');
          found.set(this.repoKey(owner, repo), { owner, repo });
        } else {
          const parsed = this.parseOwnerRepoFromHtmlUrl(c.htmlUrl || undefined);
          if (parsed) found.set(this.repoKey(parsed.owner, parsed.repo), parsed);
        }
      }
    } catch (error) {
      this.logger.warn(`❌ Failed to search commits for ${login}: ${error}`);
    }

    const repos = Array.from(found.values());
    this.logger.log(`✅ Discovered ${repos.length} repos for ${login}: ${repos.map(r => r.owner + '/' + r.repo).join(', ')}`);
    return repos;
  }


  /** repo -> set(users) map for all users with user-specific time windows */
  private async buildRepoUsersMap(userTimeWindows: Map<string, string>) {
    const map = new Map<string, { owner: string; repo: string; users: Set<string>; }>();

    const userRepoPromises = Array.from(userTimeWindows.entries()).map(async ([login, sinceIso]) => {
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
  // Ingestors (same as before)
  // =======================

  /** Issues + PRs created by users (uses ?creator=login). */
  private async ingestIssuesAndPRsByCreator(
    owner: string, repo: string, repoId: number | undefined, isPrivate: boolean | undefined,
    users: Set<string>, sinceIso: string,
  ) {
    const logins = users.size ? [...users] : [undefined];
    const rows: BronzeRow[] = [];

    for (const login of logins) {
      try {
        const pages = await this.retryWithBackoff(
          () => this.github.listIssuesAndPullsForRepo({ owner, repo, sinceIso, creatorLogin: login }),
          `Issues/PRs for ${owner}/${repo} ${login ? `(creator: ${login})` : ''}`
        );

        for (const it of pages as GithubIssueOrPRDTO[]) {
          const isPR = it.isPR;
          const event_type = isPR ? 'pull_request' : 'issue';

          const payload = it.raw;

          const row: BronzeRow = {
            event_ulid: `${event_type}:${it.id}`,
            provider: 'github',
            event_type,
            provider_event_id: String(it.id),
            actor_user_node: it.userId ? String(it.userId) : null,
            repo_node: repoId != null ? String(repoId) : null,
            target_node: String(it.id),
            created_at: it.createdAt ?? null,
            is_private: isPrivate ?? null,
            raw_payload: payload,
          };
          rows.push(row);

          if (isPR) {
            const prNumber = it.number;
            const prId = String(it.id);
            await this.ingestCommitsForPR(owner, repo, repoId, isPrivate, prNumber, prId, users);
          }
        }
      } catch (error) {
        this.logger.warn(`❌ Failed to fetch issues/PRs for ${owner}/${repo} ${login ? `(creator: ${login})` : ''}: ${error}`);
      }
    }

    for (const row of rows) {
      await this.writeEventBoth(row);
    }
  }

  /** Issue comments (filter client-side by commenter; resolve ParentID from issue_url). */
  private async ingestIssueComments(
    owner: string, repo: string, repoId: number | undefined, isPrivate: boolean | undefined,
    users: Set<string>, sinceIso: string, numberToId: Map<string, string>,
  ) {
    try {
      const comments = await this.retryWithBackoff(
        () => this.github.listIssueCommentsForRepo({ owner, repo, sinceIso }),
        `Issue comments for ${owner}/${repo}`
      );

      for (const c of comments as GithubIssueCommentDTO[]) {
        const login = c.userLogin;
        if (users.size && login && !users.has(login)) continue;

        try {
          const parentId = await this.resolveIssueParentId(owner, repo, c, numberToId);

          const row: BronzeRow = {
            event_ulid: `issue_comment:${c.id}`,
            provider: 'github',
            event_type: 'issue_comment',
            provider_event_id: String(c.id),
            actor_user_node: c.userId ? String(c.userId) : null,
            repo_node: repoId != null ? String(repoId) : null,
            target_node: parentId, // <-- Parent Issue/PR ID
            created_at: c.createdAt ?? null,
            is_private: isPrivate ?? null,
            raw_payload: c.raw,
          };
          await this.writeEventBoth(row);
        } catch (error) {
          this.logger.warn(`❌ Failed to ingest issue comment ${(c as any).id} for ${owner}/${repo}: ${error}`);
        }
      }
    } catch (error) {
      this.logger.warn(`❌ Failed to fetch issue comments for ${owner}/${repo}: ${error}`);
    }
  }

  /** PR review comments (inline) — resolve ParentID from pull_request_url. */
  private async ingestPRReviewComments(
    owner: string, repo: string, repoId: number | undefined, isPrivate: boolean | undefined,
    users: Set<string>, sinceIso: string, numberToId: Map<string, string>,
  ) {
    try {
      const comments = await this.retryWithBackoff(
        () => this.github.listReviewCommentsForRepo({ owner, repo, sinceIso }),
        `PR review comments for ${owner}/${repo}`
      );

      for (const c of comments as GithubPRReviewCommentDTO[]) {
        const login = c.userLogin;
        if (users.size && login && !users.has(login)) continue;

        const parentId = await this.resolvePRParentId(owner, repo, c, numberToId);

        const row: BronzeRow = {
          event_ulid: `pr_review_comment:${c.id}`,
          provider: 'github',
          event_type: 'pr_review_comment',
          provider_event_id: String(c.id),
          actor_user_node: c.userId ? String(c.userId) : null,
          repo_node: repoId != null ? String(repoId) : null,
          target_node: parentId, // <-- Parent PR ID
          created_at: c.createdAt ?? null,
          is_private: isPrivate ?? null,
          raw_payload: c.raw,
        };
        await this.writeEventBoth(row);
      }
    } catch (error) {
      this.logger.warn(`❌ Failed to fetch PR review comments for ${owner}/${repo}: ${error}`);
    }
  }

  /** Commits — best with author=<login>; falls back to everyone since. */
  private async ingestCommitsForUsers(
    owner: string, repo: string, repoId: number | undefined, isPrivate: boolean | undefined,
    users: Set<string>, sinceIso: string, untilIso?: string,
  ) {
    const who = users.size ? [...users] : [undefined];

    for (const login of who) {
      try {
        const params: any = { owner, repo, per_page: 100, since: sinceIso };
        if (untilIso) params.until = untilIso;
        if (login) params.author = login;

        const commits = await this.retryWithBackoff(
          () => this.github.listRepoCommits({ owner, repo, sinceIso, untilIso, authorLogin: login }),
          `Commits for ${owner}/${repo} ${login ? `(author: ${login})` : ''}`,
          5,
          3000
        );

        for (const c of commits as GithubCommitDTO[]) {
          const authorLogin = c.authorLogin;
          if (users.size && (!authorLogin || !users.has(authorLogin))) continue;

          const row: BronzeRow = {
            event_ulid: `commit:${c.sha}`,
            provider: 'github',
            event_type: 'commit',
            provider_event_id: String(c.sha),
            actor_user_node: c.authorId ? String(c.authorId) : null,
            repo_node: repoId != null ? String(repoId) : null,
            target_node: null, // no push linkage here (can be added via Events pipeline later)
            created_at: c.committedDate ?? null,
            is_private: isPrivate ?? null,
            raw_payload: c.raw,
          };
          await this.writeEventBoth(row);
        }
      } catch (error) {
        this.logger.warn(`❌ Failed to fetch commits for ${owner}/${repo} ${login ? `(author: ${login})` : ''}: ${error}`);
      }
    }
  }

  // =======================
  // orchestrator
  // =======================

  /**
   *  - discover per-user repos since `sinceIso`
   *  - merge into repo -> set(users) map
   *  - ingest each repo ONCE, using only the users who actually contributed there
   */
  async ingestEachUserInTheirRepos(
    usersArray: string[],
    sinceIso?: string,
    untilIso?: string,
  ) {
    const inputUsers = new Set(usersArray.map((s) => s.trim()).filter(Boolean));

    if (!inputUsers.size) throw new Error('users list is required');

    const until = untilIso ?? this.isoNow();

    // Get all users in DB and find excluded users
    const allDbUsers = await this.getAllDbUsers();
    const excludedUsers = this.findExcludedUsers(allDbUsers, Array.from(inputUsers));

    if (excludedUsers.length > 0) {
      this.logger.log(`📋 Found ${excludedUsers.length} excluded users (in DB but not in input): ${excludedUsers.join(', ')}`);
    }

    // Combine input users + excluded users for data collection
    const allUsersToProcess = new Set([...inputUsers, ...excludedUsers]);

    // Check which users exist in gold.user_profile (all users)
    const existingUsers = await this.checkUsersInGoldProfile([...allUsersToProcess]);

    // Create user-specific time windows for ALL users
    const userTimeWindows = new Map<string, string>();
    for (const user of allUsersToProcess) {
      if (existingUsers.has(user)) {
        // Existing user: last 48 hours
        userTimeWindows.set(user, sinceIso ?? this.isoHoursAgo(48));
        this.logger.log(`📅 User ${user}: fetching last 2 days (existing user)`);
      } else {
        // New user: last 6 months
        userTimeWindows.set(user, sinceIso ?? this.isoDaysAgo(180));
        this.logger.log(`📅 User ${user}: fetching last 180 days (new user)`);
      }
    }

    await this.upsertUserProfilesToBronze([...allUsersToProcess]);
    const repoUsers = await this.buildRepoUsersMap(userTimeWindows);

    // Fetch all repo metadata in parallel
    const repoList = Array.from(repoUsers.values());
    const repoMetaMap = await this.fetchMultipleReposMeta(
      repoList.map(({ owner, repo }) => ({ owner, repo }))
    );

    let ingestedRepos = 0;
    const totalRepos = Array.from(repoUsers.values()).length;
    for (const { owner, repo, users: usersForRepo } of repoUsers.values()) {
      this.logger.log(`🔄 Processing repo ${ingestedRepos + 1}/${totalRepos}: ${owner}/${repo}`);
      const meta = repoMetaMap.get(this.repoKey(owner, repo));
      if (!meta) {
        this.logger.warn(`❌ No metadata found for ${owner}/${repo}, skipping`);
        continue;
      }

      // Use the earliest time window among users for this repo
      const repoSince = Math.min(...Array.from(usersForRepo).map(user =>
        new Date(userTimeWindows.get(user) || this.isoDaysAgo(180)).getTime()
      ));
      const repoSinceIso = new Date(repoSince).toISOString().replace(/\.\d{3}Z$/, 'Z');

      const numberToId = await this.buildNumberToIdMap(meta.owner, meta.name, repoSinceIso);
      await this.ingestIssuesAndPRsByCreator(meta.owner, meta.name, meta.id, meta.private, usersForRepo, repoSinceIso);
      await this.ingestIssueComments(meta.owner, meta.name, meta.id, meta.private, usersForRepo, repoSinceIso, numberToId);
      await this.ingestPRReviewComments(meta.owner, meta.name, meta.id, meta.private, usersForRepo, repoSinceIso, numberToId);
      await this.ingestCommitsForUsers(meta.owner, meta.name, meta.id, meta.private, usersForRepo, repoSinceIso, until);
      ingestedRepos++;
      this.logger.log(`✅ Completed repo ${ingestedRepos}/${totalRepos}: ${owner}/${repo}`);
    }

    // For backward compatibility, use the earliest time window as 'since'
    const earliestSince = Math.min(...Array.from(userTimeWindows.values()).map(iso => new Date(iso).getTime()));
    const since = new Date(earliestSince).toISOString().replace(/\.\d{3}Z$/, 'Z');

    return {
      mode: 'per-user-repos',
      users: [...inputUsers],
      excludedUsers,
      repos: ingestedRepos,
      since,
      until,
      userTimeWindows: Object.fromEntries(userTimeWindows)
    };
  }


}