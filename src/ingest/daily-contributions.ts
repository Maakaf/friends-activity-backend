import type { GraphqlClient } from './graphql-client.js';
import type {
  FlatContributionsResponse,
  FlatIssueContribEvent,
  FlatPRContribEvent,
  FlatReviewContribEvent,
  IssueCommentNode,
  PullRequestReviewNode,
  RepoCommitsHistoryResponse,
  RepoMetadata,
  UserNode,
} from './graphql-types.js';
import {
  FLAT_ISSUE_CONTRIBUTIONS_QUERY,
  FLAT_PR_CONTRIBUTIONS_QUERY,
  FLAT_REVIEW_CONTRIBUTIONS_QUERY,
  REPO_COMMITS_HISTORY_QUERY,
} from './graphql-queries.js';
import type { RepoRef } from './overflow.js';
import { MAX_REPOSITORIES, MIN_FORK_COUNT } from './constants.js';

export interface OverflowCommitEvent {
  nameWithOwner: string;
  committedDate: string;
}

export interface OverflowCommitWalk {
  events: OverflowCommitEvent[];
  totalsByRepo: Map<string, number>;
}

/**
 * Walks defaultBranchRef.history per overflow commit repo. Returns dated events
 * (for the daily timeline) and per-repo totals (for the table). Both consumers
 * share a single set of GraphQL calls — no duplicate fetching.
 */
export async function walkOverflowCommits(
  client: GraphqlClient,
  userGlobalId: string,
  sinceISO: string,
  repos: RepoRef[],
): Promise<OverflowCommitWalk> {
  const results = await Promise.all(
    repos
      .filter((repo) => repo.forkCount >= MIN_FORK_COUNT)
      .map(async (repo) => {
        const [owner, name] = repo.nameWithOwner.split('/');
        if (!owner || !name) return null;
        const repoEvents: OverflowCommitEvent[] = [];
        let after: string | null = null;
        while (true) {
          const res: RepoCommitsHistoryResponse =
            await client.call<RepoCommitsHistoryResponse>(
              REPO_COMMITS_HISTORY_QUERY,
              { owner, name, since: sinceISO, authorId: userGlobalId, after },
            );
          const history = res.repository?.defaultBranchRef?.target?.history;
          if (!history) break;
          for (const commit of history.nodes) {
            repoEvents.push({
              nameWithOwner: repo.nameWithOwner,
              committedDate: commit.committedDate,
            });
          }
          if (!history.pageInfo.hasNextPage) break;
          if (after !== null && history.pageInfo.endCursor === after) break;
          after = history.pageInfo.endCursor;
        }
        return { nameWithOwner: repo.nameWithOwner, repoEvents };
      }),
  );

  const events: OverflowCommitEvent[] = [];
  const totalsByRepo = new Map<string, number>();
  for (const result of results) {
    if (!result || result.repoEvents.length === 0) continue;
    for (const ev of result.repoEvents) events.push(ev);
    totalsByRepo.set(result.nameWithOwner, result.repoEvents.length);
  }
  return { events, totalsByRepo };
}

export interface ComputeDailyOptions {
  client: GraphqlClient;
  login: string;
  sinceISO: string;
  user: UserNode;
  overflowCommitEvents: OverflowCommitEvent[];
  reviewsInWindow: PullRequestReviewNode[];
  commentsInWindow: IssueCommentNode[];
  metadata: Map<string, RepoMetadata>;
}

export async function computeOssDailyContributions(
  opts: ComputeDailyOptions,
): Promise<Map<string, number>> {
  const {
    client,
    login,
    sinceISO,
    user,
    overflowCommitEvents,
    reviewsInWindow,
    commentsInWindow,
    metadata,
  } = opts;
  const counts = new Map<string, number>();
  const addToDay = (isoTimestamp: string, by = 1) => {
    const day = isoTimestamp.slice(0, 10);
    counts.set(day, (counts.get(day) || 0) + by);
  };
  const isOss = (nameWithOwner: string) => {
    const m = metadata.get(nameWithOwner);
    return !!m && m.forkCount >= MIN_FORK_COUNT;
  };

  const cc = user.contributionsCollection;

  // Commits — bucketed (no flat list exists on contributionsCollection)
  for (const bucket of cc.commitContributionsByRepository) {
    if (!isOss(bucket.repository.nameWithOwner)) continue;
    for (const ev of bucket.contributions.nodes) addToDay(ev.occurredAt, ev.commitCount);
  }
  // Commits in overflow repos (>100 cap): pre-walked by walkOverflowCommits()
  // so the table and graph share a single fetch.
  for (const ev of overflowCommitEvents) addToDay(ev.committedDate);

  await Promise.all([
    flatOrBucketed<FlatPRContribEvent>(
      cc.pullRequestContributionsByRepository,
      cc.totalRepositoriesWithContributedPullRequests,
      client,
      FLAT_PR_CONTRIBUTIONS_QUERY,
      'pullRequestContributions',
      login,
      sinceISO,
      isOss,
      addToDay,
      (ev) => ev.pullRequest?.repository,
    ),
    flatOrBucketed<FlatIssueContribEvent>(
      cc.issueContributionsByRepository,
      cc.totalRepositoriesWithContributedIssues,
      client,
      FLAT_ISSUE_CONTRIBUTIONS_QUERY,
      'issueContributions',
      login,
      sinceISO,
      isOss,
      addToDay,
      (ev) => ev.issue?.repository,
    ),
    flatOrBucketed<FlatReviewContribEvent>(
      cc.pullRequestReviewContributionsByRepository,
      cc.totalRepositoriesWithContributedPullRequestReviews,
      client,
      FLAT_REVIEW_CONTRIBUTIONS_QUERY,
      'pullRequestReviewContributions',
      login,
      sinceISO,
      isOss,
      addToDay,
      (ev) => ev.pullRequestReview?.repository,
    ),
  ]);

  // Inline review comments (table also counts these in prComments)
  for (const review of reviewsInWindow) {
    if (!isOss(review.repository.nameWithOwner)) continue;
    const inlineCount = review.comments?.totalCount ?? 0;
    if (inlineCount > 0) addToDay(review.createdAt, inlineCount);
  }

  // Issue + PR conversation comments
  for (const comment of commentsInWindow) {
    if (!isOss(comment.repository.nameWithOwner)) continue;
    addToDay(comment.createdAt);
  }

  return counts;
}

async function flatOrBucketed<TFlatNode extends { occurredAt: string }>(
  buckets: Array<{
    repository: { nameWithOwner: string };
    contributions: {
      pageInfo: { hasNextPage: boolean };
      nodes: Array<{ occurredAt: string }>;
    };
  }>,
  totalRepos: number,
  client: GraphqlClient,
  flatQuery: string,
  field: string,
  login: string,
  sinceISO: string,
  isOss: (n: string) => boolean,
  addToDay: (iso: string, by?: number) => void,
  flatRepoOf: (
    ev: TFlatNode,
  ) => { nameWithOwner: string; forkCount: number } | undefined,
): Promise<void> {
  const overflow =
    totalRepos > MAX_REPOSITORIES ||
    buckets.some((b) => b.contributions.pageInfo.hasNextPage);
  if (overflow) {
    const flat = await fetchAllFlat<TFlatNode>(
      client,
      flatQuery,
      field,
      login,
      sinceISO,
    );
    for (const ev of flat) {
      const repo = flatRepoOf(ev);
      if (repo && repo.forkCount >= MIN_FORK_COUNT) addToDay(ev.occurredAt);
    }
    return;
  }
  for (const bucket of buckets) {
    if (!isOss(bucket.repository.nameWithOwner)) continue;
    for (const ev of bucket.contributions.nodes) addToDay(ev.occurredAt);
  }
}

async function fetchAllFlat<TNode>(
  client: GraphqlClient,
  query: string,
  field: string,
  login: string,
  sinceISO: string,
): Promise<TNode[]> {
  const out: TNode[] = [];
  let after: string | null = null;
  while (true) {
    const res: FlatContributionsResponse<TNode> = await client.call<
      FlatContributionsResponse<TNode>
    >(query, { login, since: sinceISO, after });
    const conn = res.user?.contributionsCollection?.[field];
    if (!conn) break;
    for (const n of conn.nodes) out.push(n);
    if (!conn.pageInfo.hasNextPage) break;
    if (after !== null && conn.pageInfo.endCursor === after) break;
    after = conn.pageInfo.endCursor;
  }
  return out;
}
