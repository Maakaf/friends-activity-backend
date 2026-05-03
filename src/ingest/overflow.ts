import type { GraphqlClient } from './graphql-client.js';
import type { ReposContributedToResponse } from './graphql-types.js';
import { REPOS_CONTRIBUTED_TO_QUERY } from './graphql-queries.js';

const OVERFLOW_BATCH_SIZE = 25;

export type ContributionType =
  | 'COMMIT'
  | 'PULL_REQUEST'
  | 'ISSUE'
  | 'PULL_REQUEST_REVIEW';

export interface RepoRef {
  id: string;
  databaseId: number | null;
  nameWithOwner: string;
  forkCount: number;
}

export interface OverflowCounts {
  commits: number;
  prs: number;
  issues: number;
  reviews: number;
}

export async function paginateReposContributedTo(
  client: GraphqlClient,
  login: string,
  contributionType: ContributionType,
): Promise<RepoRef[]> {
  const out: RepoRef[] = [];
  let cursor: string | null = null;
  let hasNext = true;
  while (hasNext) {
    const res: ReposContributedToResponse =
      await client.call<ReposContributedToResponse>(
        REPOS_CONTRIBUTED_TO_QUERY,
        {
          login,
          types: [contributionType],
          after: cursor,
        },
      );
    if (!res.user) break;
    const conn = res.user.repositoriesContributedTo;
    const nextCursor = conn.pageInfo.endCursor;
    if (cursor !== null && nextCursor === cursor) break;
    for (const n of conn.nodes) if (n) out.push(n);
    cursor = nextCursor;
    hasNext = conn.pageInfo.hasNextPage;
  }
  return out;
}

export async function fetchOverflowCounts(
  client: GraphqlClient,
  login: string,
  userGlobalId: string,
  sinceISO: string,
  overflow: {
    COMMIT: RepoRef[];
    PULL_REQUEST: RepoRef[];
    ISSUE: RepoRef[];
    PULL_REQUEST_REVIEW: RepoRef[];
  },
  precomputedCommitTotals?: Map<string, number>,
): Promise<Map<string, OverflowCounts>> {
  const out = new Map<string, OverflowCounts>();
  const ensure = (nameWithOwner: string) => {
    let bucket = out.get(nameWithOwner);
    if (!bucket) {
      bucket = { commits: 0, prs: 0, issues: 0, reviews: 0 };
      out.set(nameWithOwner, bucket);
    }
    return bucket;
  };

  type Job =
    | { kind: 'commit'; repo: { nameWithOwner: string } }
    | { kind: 'pr' | 'issue' | 'review'; repo: { nameWithOwner: string } };

  if (precomputedCommitTotals) {
    for (const [name, count] of precomputedCommitTotals) {
      ensure(name).commits = count;
    }
  }

  const jobs: Job[] = [
    ...(precomputedCommitTotals
      ? []
      : overflow.COMMIT.map((r) => ({ kind: 'commit' as const, repo: r }))),
    ...overflow.PULL_REQUEST.map((r) => ({ kind: 'pr' as const, repo: r })),
    ...overflow.ISSUE.map((r) => ({ kind: 'issue' as const, repo: r })),
    ...overflow.PULL_REQUEST_REVIEW.map((r) => ({
      kind: 'review' as const,
      repo: r,
    })),
  ];
  if (jobs.length === 0) return out;

  for (let i = 0; i < jobs.length; i += OVERFLOW_BATCH_SIZE) {
    const chunk = jobs.slice(i, i + OVERFLOW_BATCH_SIZE);
    const fragments: string[] = [];
    const variables: Record<string, unknown> = {};
    const varDefs: string[] = [];
    let usesSince = false;
    let usesAuthorId = false;
    const aliases: string[] = [];

    chunk.forEach((job, idx) => {
      const a = `${job.kind}${idx}`;
      aliases.push(a);
      if (job.kind === 'commit') {
        usesSince = true;
        usesAuthorId = true;
        const [owner, name] = job.repo.nameWithOwner.split('/');
        const ov = `${a}_owner`;
        const nv = `${a}_name`;
        variables[ov] = owner;
        variables[nv] = name;
        varDefs.push(`$${ov}: String!`, `$${nv}: String!`);
        fragments.push(`
          ${a}: repository(owner: $${ov}, name: $${nv}) {
            defaultBranchRef {
              target {
                ... on Commit {
                  history(since: $since, author: { id: $authorId }) { totalCount }
                }
              }
            }
          }`);
      } else {
        const qv = `${a}_q`;
        const qualifier =
          job.kind === 'pr'
            ? `repo:${job.repo.nameWithOwner} author:${login} is:pr created:>=${sinceISO}`
            : job.kind === 'issue'
              ? `repo:${job.repo.nameWithOwner} author:${login} is:issue created:>=${sinceISO}`
              : `repo:${job.repo.nameWithOwner} reviewed-by:${login} is:pr updated:>=${sinceISO}`;
        variables[qv] = qualifier;
        varDefs.push(`$${qv}: String!`);
        fragments.push(`
          ${a}: search(query: $${qv}, type: ISSUE, first: 0) { issueCount }`);
      }
    });

    if (usesSince) {
      variables.since = sinceISO;
      varDefs.unshift(`$since: GitTimestamp!`);
    }
    if (usesAuthorId) {
      variables.authorId = userGlobalId;
      varDefs.unshift(`$authorId: ID!`);
    }

    const query = `query OverflowCounts(${varDefs.join(', ')}) {
      rateLimit { limit cost remaining resetAt }
      ${fragments.join('\n')}
    }`;

    const res: Record<string, unknown> = await client.call<
      Record<string, unknown>
    >(query, variables);

    chunk.forEach((job, idx) => {
      const a = aliases[idx];
      if (job.kind === 'commit') {
        const node = res[a] as {
          defaultBranchRef: {
            target: { history: { totalCount: number } } | null;
          } | null;
        } | null;
        ensure(job.repo.nameWithOwner).commits =
          node?.defaultBranchRef?.target?.history?.totalCount ?? 0;
      } else {
        const node = res[a] as { issueCount: number } | null;
        const count = node?.issueCount ?? 0;
        const bucket = ensure(job.repo.nameWithOwner);
        if (job.kind === 'pr') bucket.prs = count;
        else if (job.kind === 'issue') bucket.issues = count;
        else bucket.reviews = count;
      }
    });
  }

  return out;
}
