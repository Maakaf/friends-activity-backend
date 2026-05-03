import { aggregate } from '../aggregate.js';
import type {
  IssueCommentNode,
  PullRequestReviewNode,
  RepoMetadata,
  UserNode,
} from '../graphql-types.js';
import type { OverflowCounts } from '../overflow.js';

const repoRef = (id: string, nameWithOwner: string, databaseId = 1) => ({
  id,
  databaseId,
  nameWithOwner,
});

const userBase = (
  overrides: Partial<UserNode['contributionsCollection']> = {},
): UserNode => ({
  id: 'U_1',
  databaseId: 1,
  login: 'tester',
  name: null,
  avatarUrl: '',
  url: '',
  bio: null,
  location: null,
  company: null,
  websiteUrl: null,
  twitterUsername: null,
  createdAt: '2020-01-01T00:00:00Z',
  followers: { totalCount: 0 },
  following: { totalCount: 0 },
  repositories: { totalCount: 0 },
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
    ...overrides,
  },
  issueComments: {
    totalCount: 0,
    pageInfo: { hasPreviousPage: false, startCursor: null },
    nodes: [],
  },
});

const meta = (
  nameWithOwner: string,
  fields: Partial<RepoMetadata> = {},
): RepoMetadata => ({
  id: 'R_' + nameWithOwner,
  databaseId: 1,
  nameWithOwner,
  description: null,
  url: '',
  forkCount: 0,
  isPrivate: false,
  stargazerCount: 0,
  primaryLanguage: null,
  licenseInfo: null,
  repositoryTopics: {
    pageInfo: { hasNextPage: false, endCursor: null },
    nodes: [],
  },
  ...fields,
});

describe('aggregate', () => {
  it('places contribution counts into matching repo buckets', () => {
    const user = userBase({
      commitContributionsByRepository: [
        {
          repository: repoRef('R_a', 'org/a'),
          contributions: { totalCount: 5 },
        },
      ],
      pullRequestContributionsByRepository: [
        {
          repository: repoRef('R_a', 'org/a'),
          contributions: { totalCount: 2 },
        },
      ],
      issueContributionsByRepository: [
        {
          repository: repoRef('R_b', 'org/b'),
          contributions: { totalCount: 3 },
        },
      ],
      pullRequestReviewContributionsByRepository: [
        {
          repository: repoRef('R_a', 'org/a'),
          contributions: { totalCount: 4 },
        },
      ],
    });

    const result = aggregate(user, [], [], new Map(), new Map());

    expect(result.get('org/a')).toMatchObject({
      commits: 5,
      pullRequests: 2,
      prReviews: 4,
      issues: 0,
    });
    expect(result.get('org/b')).toMatchObject({ issues: 3, commits: 0 });
  });

  it('routes user.issueComments with pullRequest set to prComments', () => {
    const user = userBase();
    const comments: IssueCommentNode[] = [
      {
        createdAt: '2026-01-01T00:00:00Z',
        repository: { id: 'R_a', databaseId: 1, nameWithOwner: 'org/a' },
        issue: null,
        pullRequest: { id: 'P1' },
      },
      {
        createdAt: '2026-01-02T00:00:00Z',
        repository: { id: 'R_a', databaseId: 1, nameWithOwner: 'org/a' },
        issue: null,
        pullRequest: { id: 'P2' },
      },
    ];
    const result = aggregate(user, comments, [], new Map(), new Map());
    expect(result.get('org/a')).toMatchObject({
      prComments: 2,
      issueComments: 0,
    });
  });

  it('routes user.issueComments with issue set to issueComments', () => {
    const user = userBase();
    const comments: IssueCommentNode[] = [
      {
        createdAt: '2026-01-01T00:00:00Z',
        repository: { id: 'R_a', databaseId: 1, nameWithOwner: 'org/a' },
        issue: { id: 'I1' },
        pullRequest: null,
      },
    ];
    const result = aggregate(user, comments, [], new Map(), new Map());
    expect(result.get('org/a')).toMatchObject({
      issueComments: 1,
      prComments: 0,
    });
  });

  it('sums review.comments.totalCount per repo into prComments', () => {
    const user = userBase();
    const reviews: PullRequestReviewNode[] = [
      {
        createdAt: '2026-01-01T00:00:00Z',
        repository: { id: 'R_a', databaseId: 1, nameWithOwner: 'org/a' },
        comments: { totalCount: 3 },
      },
      {
        createdAt: '2026-01-02T00:00:00Z',
        repository: { id: 'R_a', databaseId: 1, nameWithOwner: 'org/a' },
        comments: { totalCount: 7 },
      },
    ];
    const result = aggregate(user, [], reviews, new Map(), new Map());
    expect(result.get('org/a')?.prComments).toBe(10);
  });

  it('combines PR-conversation comments and inline review comments', () => {
    const user = userBase();
    const comments: IssueCommentNode[] = [
      {
        createdAt: '2026-01-01T00:00:00Z',
        repository: { id: 'R_a', databaseId: 1, nameWithOwner: 'org/a' },
        issue: null,
        pullRequest: { id: 'P1' },
      },
    ];
    const reviews: PullRequestReviewNode[] = [
      {
        createdAt: '2026-01-02T00:00:00Z',
        repository: { id: 'R_a', databaseId: 1, nameWithOwner: 'org/a' },
        comments: { totalCount: 5 },
      },
    ];
    const result = aggregate(user, comments, reviews, new Map(), new Map());
    expect(result.get('org/a')?.prComments).toBe(6);
  });

  it('attaches metadata (description, language, topics) from the metadata map', () => {
    const user = userBase({
      commitContributionsByRepository: [
        {
          repository: repoRef('R_a', 'org/a'),
          contributions: { totalCount: 1 },
        },
      ],
    });
    const md = new Map([
      [
        'org/a',
        meta('org/a', {
          description: 'cool repo',
          url: 'https://example.test/a',
          stargazerCount: 42,
          primaryLanguage: { name: 'TypeScript', color: '#3178C6' },
          licenseInfo: { name: 'MIT', spdxId: 'MIT' },
          repositoryTopics: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              { topic: { name: 'typescript' } },
              { topic: { name: 'graphql' } },
            ],
          },
        }),
      ],
    ]);
    const result = aggregate(user, [], [], md, new Map());
    const bucket = result.get('org/a');
    expect(bucket).toMatchObject({
      description: 'cool repo',
      url: 'https://example.test/a',
      stargazerCount: 42,
      primaryLanguage: 'TypeScript',
      primaryLanguageColor: '#3178C6',
      licenseName: 'MIT',
      licenseSpdx: 'MIT',
      topics: ['typescript', 'graphql'],
    });
  });

  it('overflow counts overwrite bucket counts for same repo', () => {
    const user = userBase({
      commitContributionsByRepository: [
        {
          repository: repoRef('R_a', 'org/a'),
          contributions: { totalCount: 50 },
        },
      ],
    });
    const overflow = new Map<string, OverflowCounts>([
      ['org/a', { commits: 200, prs: 0, issues: 0, reviews: 0 }],
    ]);
    const result = aggregate(user, [], [], new Map(), overflow);
    expect(result.get('org/a')?.commits).toBe(200);
  });

  it('overflow zero counts do not overwrite existing non-zero bucket counts', () => {
    const user = userBase({
      commitContributionsByRepository: [
        {
          repository: repoRef('R_a', 'org/a'),
          contributions: { totalCount: 7 },
        },
      ],
    });
    const overflow = new Map<string, OverflowCounts>([
      ['org/a', { commits: 0, prs: 5, issues: 0, reviews: 0 }],
    ]);
    const result = aggregate(user, [], [], new Map(), overflow);
    expect(result.get('org/a')?.commits).toBe(7);
    expect(result.get('org/a')?.pullRequests).toBe(5);
  });

  it('creates a bucket for an overflow-only repo (not seen elsewhere)', () => {
    const user = userBase();
    const md = new Map([['org/x', meta('org/x', { stargazerCount: 99 })]]);
    const overflow = new Map<string, OverflowCounts>([
      ['org/x', { commits: 1, prs: 2, issues: 3, reviews: 4 }],
    ]);
    const result = aggregate(user, [], [], md, overflow);
    expect(result.get('org/x')).toMatchObject({
      commits: 1,
      pullRequests: 2,
      issues: 3,
      prReviews: 4,
      stargazerCount: 99,
    });
  });
});
