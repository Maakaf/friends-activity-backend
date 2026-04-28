export interface RateLimit {
  limit: number;
  cost: number;
  remaining: number;
  resetAt: string;
}

export interface RepositoryRef {
  id: string;
  databaseId: number | null;
  nameWithOwner: string;
}

export interface RepositoryTopicsConnection {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: Array<{ topic: { name: string } } | null>;
}

export interface RepoMetadata {
  id: string;
  databaseId: number | null;
  nameWithOwner: string;
  description: string | null;
  url: string;
  forkCount: number;
  isPrivate: boolean;
  stargazerCount: number;
  primaryLanguage: { name: string; color: string | null } | null;
  licenseInfo: { name: string; spdxId: string | null } | null;
  repositoryTopics: RepositoryTopicsConnection;
}

export interface RepoTopicsPageResponse {
  rateLimit: RateLimit | null;
  node: { repositoryTopics: RepositoryTopicsConnection } | null;
}

export interface RepoMetadataResponse {
  rateLimit: RateLimit | null;
  nodes: Array<RepoMetadata | null>;
}

export interface ContributionsByRepo {
  repository: RepositoryRef;
  contributions: { totalCount: number };
}

export interface ContributionsCollection {
  totalCommitContributions: number;
  totalPullRequestContributions: number;
  totalIssueContributions: number;
  totalPullRequestReviewContributions: number;
  totalRepositoriesWithContributedCommits: number;
  totalRepositoriesWithContributedPullRequests: number;
  totalRepositoriesWithContributedIssues: number;
  totalRepositoriesWithContributedPullRequestReviews: number;
  commitContributionsByRepository: ContributionsByRepo[];
  pullRequestContributionsByRepository: ContributionsByRepo[];
  issueContributionsByRepository: ContributionsByRepo[];
  pullRequestReviewContributionsByRepository: ContributionsByRepo[];
}

export interface ReposContributedToConnection {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: Array<{
    id: string;
    databaseId: number | null;
    nameWithOwner: string;
  } | null>;
}

export interface ReposContributedToResponse {
  rateLimit: RateLimit | null;
  user: { repositoriesContributedTo: ReposContributedToConnection } | null;
}

export interface IssueCommentNode {
  createdAt: string;
  repository: { id: string; databaseId: number | null; nameWithOwner: string };
  issue: { id: string } | null;
  pullRequest: { id: string } | null;
}

export interface IssueCommentsConnection {
  totalCount: number;
  pageInfo: { hasPreviousPage: boolean; startCursor: string | null };
  nodes: IssueCommentNode[];
}

export interface UserNode {
  id: string;
  databaseId: number | null;
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  websiteUrl: string | null;
  twitterUsername: string | null;
  createdAt: string;
  followers: { totalCount: number };
  following: { totalCount: number };
  repositories: { totalCount: number };
  contributionsCollection: ContributionsCollection;
  issueComments: IssueCommentsConnection;
}

export interface UserActivityResponse {
  rateLimit: RateLimit | null;
  user: UserNode | null;
}

export interface UserCommentsPageResponse {
  rateLimit: RateLimit | null;
  user: { issueComments: IssueCommentsConnection } | null;
}

export interface PullRequestReviewNode {
  createdAt: string;
  repository: { id: string; databaseId: number | null; nameWithOwner: string };
  comments: { totalCount: number };
}

export interface PullRequestReviewContributionsConnection {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: Array<{ pullRequestReview: PullRequestReviewNode | null }>;
}

export interface UserPRReviewsResponse {
  rateLimit: RateLimit | null;
  user: {
    contributionsCollection: {
      pullRequestReviewContributions: PullRequestReviewContributionsConnection;
    };
  } | null;
}

export interface GraphqlErrorBody {
  errors: Array<{ message: string; path?: string[]; extensions?: unknown }>;
}
