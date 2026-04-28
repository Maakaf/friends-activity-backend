import {
  paginateIssueComments,
  fetchPRReviewsInWindow,
} from '../pagination.js';
import type { GraphqlClient } from '../graphql-client.js';
import type { UserNode } from '../graphql-types.js';

interface MockCall {
  query: string;
  variables: Record<string, unknown>;
}

const mockClient = (
  responses: unknown[],
): { client: GraphqlClient; calls: MockCall[] } => {
  const calls: MockCall[] = [];
  let i = 0;
  const client = {
    call: <T>(
      query: string,
      variables: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ query, variables });
      const r = responses[i++];
      return Promise.resolve(r as T);
    },
  } as unknown as GraphqlClient;
  return { client, calls };
};

const userWithComments = (
  nodes: Array<{ createdAt: string; cursor?: string }>,
  startCursor: string | null,
  hasPrevious: boolean,
): UserNode =>
  ({
    id: 'U_1',
    databaseId: 1,
    login: 'tester',
    issueComments: {
      totalCount: nodes.length,
      pageInfo: { hasPreviousPage: hasPrevious, startCursor },
      nodes: nodes.map((n) => ({
        createdAt: n.createdAt,
        repository: { id: 'R_a', databaseId: 1, nameWithOwner: 'org/a' },
        issue: { id: 'I' },
        pullRequest: null,
      })),
    },
    contributionsCollection: {
      totalCommitContributions: 0,
      totalPullRequestContributions: 0,
      totalIssueContributions: 0,
      totalPullRequestReviewContributions: 0,
      totalRepositoriesWithContributedCommits: 0,
      totalRepositoriesWithContributedPullRequests: 0,
      totalRepositoriesWithContributedIssues: 0,
      totalRepositoriesWithContributedPullRequestReviews: 0,
      commitContributionsByRepository: [],
      pullRequestContributionsByRepository: [],
      issueContributionsByRepository: [],
      pullRequestReviewContributionsByRepository: [],
    },
  }) as unknown as UserNode;

describe('paginateIssueComments', () => {
  it('returns the embedded first page when there are no previous pages', async () => {
    const user = userWithComments(
      [{ createdAt: '2026-04-01T00:00:00Z' }],
      null,
      false,
    );
    const { client, calls } = mockClient([]);
    const sinceMs = new Date('2026-01-01T00:00:00Z').getTime();
    const out = await paginateIssueComments(client, 'tester', user, sinceMs);
    expect(out.pagesFetched).toBe(1);
    expect(out.nodes).toHaveLength(1);
    expect(calls).toHaveLength(0);
  });

  it('halts when the oldest node falls below the window boundary', async () => {
    const sinceMs = new Date('2026-01-01T00:00:00Z').getTime();
    const user = userWithComments(
      [{ createdAt: '2025-12-01T00:00:00Z' }],
      'cursor1',
      true,
    );
    const { client, calls } = mockClient([]);
    const out = await paginateIssueComments(client, 'tester', user, sinceMs);
    expect(out.pagesFetched).toBe(1);
    expect(calls).toHaveLength(0);
  });

  it('walks pages until previous-page is false', async () => {
    const sinceMs = new Date('2026-01-01T00:00:00Z').getTime();
    const user = userWithComments(
      [{ createdAt: '2026-04-01T00:00:00Z' }],
      'cursor1',
      true,
    );
    const { client, calls } = mockClient([
      {
        user: {
          issueComments: {
            totalCount: 2,
            pageInfo: { hasPreviousPage: true, startCursor: 'cursor2' },
            nodes: [
              {
                createdAt: '2026-03-01T00:00:00Z',
                repository: {
                  id: 'R_a',
                  databaseId: 1,
                  nameWithOwner: 'org/a',
                },
                issue: { id: 'I' },
                pullRequest: null,
              },
            ],
          },
        },
      },
      {
        user: {
          issueComments: {
            totalCount: 3,
            pageInfo: { hasPreviousPage: false, startCursor: null },
            nodes: [
              {
                createdAt: '2026-02-01T00:00:00Z',
                repository: {
                  id: 'R_a',
                  databaseId: 1,
                  nameWithOwner: 'org/a',
                },
                issue: { id: 'I' },
                pullRequest: null,
              },
            ],
          },
        },
      },
    ]);
    const out = await paginateIssueComments(client, 'tester', user, sinceMs);
    expect(out.pagesFetched).toBe(3);
    expect(out.nodes).toHaveLength(3);
    expect(calls).toHaveLength(2);
  });

  it('halts on cursor stagnation (server returns same cursor twice)', async () => {
    const sinceMs = new Date('2026-01-01T00:00:00Z').getTime();
    const user = userWithComments(
      [{ createdAt: '2026-04-01T00:00:00Z' }],
      'stuck',
      true,
    );
    const { client, calls } = mockClient([
      {
        user: {
          issueComments: {
            totalCount: 2,
            pageInfo: { hasPreviousPage: true, startCursor: 'stuck' },
            nodes: [
              {
                createdAt: '2026-03-01T00:00:00Z',
                repository: {
                  id: 'R_a',
                  databaseId: 1,
                  nameWithOwner: 'org/a',
                },
                issue: { id: 'I' },
                pullRequest: null,
              },
            ],
          },
        },
      },
    ]);
    const out = await paginateIssueComments(client, 'tester', user, sinceMs);
    expect(calls).toHaveLength(1);
    expect(out.nodes).toHaveLength(1);
  });
});

describe('fetchPRReviewsInWindow', () => {
  const reviewPage = (
    nodes: Array<{ totalCount: number }>,
    endCursor: string | null,
    hasNext: boolean,
  ) => ({
    user: {
      contributionsCollection: {
        pullRequestReviewContributions: {
          pageInfo: { hasNextPage: hasNext, endCursor },
          nodes: nodes.map((n) => ({
            pullRequestReview: {
              createdAt: '2026-03-01T00:00:00Z',
              repository: { id: 'R_a', databaseId: 1, nameWithOwner: 'org/a' },
              comments: { totalCount: n.totalCount },
            },
          })),
        },
      },
    },
  });

  it('halts after first page when hasNextPage is false', async () => {
    const { client, calls } = mockClient([
      reviewPage([{ totalCount: 5 }], null, false),
    ]);
    const out = await fetchPRReviewsInWindow(
      client,
      'tester',
      '2025-10-29T00:00:00Z',
    );
    expect(out.pagesFetched).toBe(1);
    expect(out.reviewsInWindow).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it('walks forward via after cursor across multiple pages', async () => {
    const { client, calls } = mockClient([
      reviewPage([{ totalCount: 1 }], 'p1', true),
      reviewPage([{ totalCount: 2 }], 'p2', true),
      reviewPage([{ totalCount: 3 }], null, false),
    ]);
    const out = await fetchPRReviewsInWindow(
      client,
      'tester',
      '2025-10-29T00:00:00Z',
    );
    expect(out.pagesFetched).toBe(3);
    expect(out.reviewsInWindow).toHaveLength(3);
    expect(calls).toHaveLength(3);
    expect(calls[1].variables).toMatchObject({ after: 'p1' });
    expect(calls[2].variables).toMatchObject({ after: 'p2' });
  });

  it('halts on cursor stagnation', async () => {
    const { client, calls } = mockClient([
      reviewPage([{ totalCount: 1 }], 'stuck', true),
      reviewPage([{ totalCount: 99 }], 'stuck', true),
    ]);
    const out = await fetchPRReviewsInWindow(
      client,
      'tester',
      '2025-10-29T00:00:00Z',
    );
    expect(calls).toHaveLength(2);
    expect(out.reviewsInWindow).toHaveLength(1);
  });
});
