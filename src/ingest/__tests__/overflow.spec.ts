import { fetchOverflowCounts } from '../overflow.js';
import type { GraphqlClient } from '../graphql-client.js';

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
      const r = responses[i++] ?? {};
      return Promise.resolve(r as T);
    },
  } as unknown as GraphqlClient;
  return { client, calls };
};

const repo = (nameWithOwner: string) => ({
  id: 'R_' + nameWithOwner,
  databaseId: 1,
  nameWithOwner,
  forkCount: 10,
});

describe('fetchOverflowCounts query construction', () => {
  it('returns empty map when no overflow', async () => {
    const { client, calls } = mockClient([]);
    const out = await fetchOverflowCounts(
      client,
      'tester',
      'U_1',
      '2025-10-29T00:00:00Z',
      {
        COMMIT: [],
        PULL_REQUEST: [],
        ISSUE: [],
        PULL_REQUEST_REVIEW: [],
      },
    );
    expect(out.size).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('declares $since and $authorId only when commit fragments are present', async () => {
    const { client, calls } = mockClient([
      {
        commit0: {
          defaultBranchRef: { target: { history: { totalCount: 42 } } },
        },
      },
    ]);
    await fetchOverflowCounts(client, 'tester', 'U_1', '2025-10-29T00:00:00Z', {
      COMMIT: [repo('org/a')],
      PULL_REQUEST: [],
      ISSUE: [],
      PULL_REQUEST_REVIEW: [],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].query).toContain('$since: GitTimestamp!');
    expect(calls[0].query).toContain('$authorId: ID!');
  });

  it('omits $since and $authorId when only search fragments are present', async () => {
    const { client, calls } = mockClient([
      {
        pr0: { issueCount: 5 },
        issue1: { issueCount: 3 },
        review2: { issueCount: 1 },
      },
    ]);
    await fetchOverflowCounts(client, 'tester', 'U_1', '2025-10-29T00:00:00Z', {
      COMMIT: [],
      PULL_REQUEST: [repo('org/a')],
      ISSUE: [repo('org/b')],
      PULL_REQUEST_REVIEW: [repo('org/c')],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].query).not.toContain('$since:');
    expect(calls[0].query).not.toContain('$authorId:');
    expect(calls[0].variables).not.toHaveProperty('since');
    expect(calls[0].variables).not.toHaveProperty('authorId');
  });

  it('builds search qualifiers with the correct repo + login + since for each kind', async () => {
    const { client, calls } = mockClient([
      {
        pr0: { issueCount: 0 },
        issue1: { issueCount: 0 },
        review2: { issueCount: 0 },
      },
    ]);
    await fetchOverflowCounts(client, 'tester', 'U_1', '2025-10-29T00:00:00Z', {
      COMMIT: [],
      PULL_REQUEST: [repo('org/p')],
      ISSUE: [repo('org/i')],
      PULL_REQUEST_REVIEW: [repo('org/r')],
    });
    const v = calls[0].variables;
    expect(v.pr0_q).toBe(
      'repo:org/p author:tester is:pr created:>=2025-10-29T00:00:00Z',
    );
    expect(v.issue1_q).toBe(
      'repo:org/i author:tester is:issue created:>=2025-10-29T00:00:00Z',
    );
    expect(v.review2_q).toBe(
      'repo:org/r reviewed-by:tester is:pr updated:>=2025-10-29T00:00:00Z',
    );
  });

  it('chunks large overflow into batches of 25', async () => {
    const repos = Array.from({ length: 60 }, (_, i) => repo(`org/r${i}`));
    const responses = [
      Object.fromEntries(
        repos.slice(0, 25).map((_, i) => [`pr${i}`, { issueCount: 0 }]),
      ),
      Object.fromEntries(
        repos.slice(25, 50).map((_, i) => [`pr${i}`, { issueCount: 0 }]),
      ),
      Object.fromEntries(
        repos.slice(50, 60).map((_, i) => [`pr${i}`, { issueCount: 0 }]),
      ),
    ];
    const { client, calls } = mockClient(responses);
    await fetchOverflowCounts(client, 'tester', 'U_1', '2025-10-29T00:00:00Z', {
      COMMIT: [],
      PULL_REQUEST: repos,
      ISSUE: [],
      PULL_REQUEST_REVIEW: [],
    });
    expect(calls).toHaveLength(3);
  });

  it('extracts commit history totalCount from response and writes to bucket', async () => {
    const { client } = mockClient([
      {
        commit0: {
          defaultBranchRef: { target: { history: { totalCount: 99 } } },
        },
      },
    ]);
    const out = await fetchOverflowCounts(
      client,
      'tester',
      'U_1',
      '2025-10-29T00:00:00Z',
      {
        COMMIT: [repo('org/a')],
        PULL_REQUEST: [],
        ISSUE: [],
        PULL_REQUEST_REVIEW: [],
      },
    );
    expect(out.get('org/a')).toMatchObject({ commits: 99 });
  });

  it('extracts search issueCount and writes to correct bucket field', async () => {
    const { client } = mockClient([
      {
        pr0: { issueCount: 7 },
        issue1: { issueCount: 11 },
        review2: { issueCount: 13 },
      },
    ]);
    const out = await fetchOverflowCounts(
      client,
      'tester',
      'U_1',
      '2025-10-29T00:00:00Z',
      {
        COMMIT: [],
        PULL_REQUEST: [repo('org/p')],
        ISSUE: [repo('org/i')],
        PULL_REQUEST_REVIEW: [repo('org/r')],
      },
    );
    expect(out.get('org/p')?.prs).toBe(7);
    expect(out.get('org/i')?.issues).toBe(11);
    expect(out.get('org/r')?.reviews).toBe(13);
  });
});
