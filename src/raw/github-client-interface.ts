// Abstraction over GitHub API used by GithubService

export type GithubClientErrorCode =
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export interface GithubClientError extends Error {
  code: GithubClientErrorCode;
  status?: number;
  retryable?: boolean;
}

// Minimal DTOs required by current GithubService usage
export interface GithubUserDTO {
  id: string; // node id as string
  login: string;
  raw: unknown;
}

export interface GithubRepoMetaDTO {
  id: number; // numeric repo id (as returned by REST)
  fullName: string; // owner/name
  ownerLogin: string;
  name: string;
  private: boolean;
  raw: unknown;
}

export interface GithubIssueOrPRDTO {
  id: string; // item id as string
  number: number;
  isPR: boolean;
  userId: string | null;
  createdAt: string | null; // ISO
  // For PR rows we sometimes need repo info to fetch PR commits later
  repoOwner?: string;
  repoName?: string;
  raw: unknown;
}

export interface GithubIssueDTO {
  id: string;
  raw: unknown;
}

export interface GithubPullRequestDTO {
  id: string;
  raw: unknown;
}

export interface GithubIssueCommentDTO {
  id: string;
  userLogin: string | null;
  userId: string | null;
  createdAt: string | null;
  // Needed for resolving parent
  issueUrl: string | null;
  raw: unknown;
}

export interface GithubPRReviewCommentDTO {
  id: string;
  userLogin: string | null;
  userId: string | null;
  createdAt: string | null;
  // Needed for resolving parent
  pullRequestUrl: string | null;
  raw: unknown;
}

export interface GithubCommitDTO {
  sha: string;
  authorLogin: string | null;
  authorId: string | null;
  committedDate: string | null; // ISO
  raw: unknown;
}

export interface GithubSearchIssueOrPRDTO {
  // Used to derive owner/repo
  repositoryUrl: string | null;
  raw: unknown;
}

export interface GithubSearchCommitDTO {
  // Prefer repository full name if present, else HTML URL can be parsed
  repositoryFullName: string | null; // "owner/name"
  htmlUrl: string | null;
  raw: unknown;
}

// The interface consumed by GithubService
export interface GithubClient {
  // Authentication lifecycle can be internal to the implementation

  // Users
  getUserByUsername(params: { username: string }): Promise<GithubUserDTO>;

  // Repos
  getRepo(params: { owner: string; repo: string }): Promise<GithubRepoMetaDTO>;
  listRepoCommits(params: {
    owner: string;
    repo: string;
    sinceIso: string;
    untilIso?: string;
    authorLogin?: string;
  }): Promise<GithubCommitDTO[]>;

  // Issues and PRs
  listIssuesAndPullsForRepo(params: {
    owner: string;
    repo: string;
    sinceIso: string;
    creatorLogin?: string;
  }): Promise<GithubIssueOrPRDTO[]>;

  getIssue(params: { owner: string; repo: string; issueNumber: number }): Promise<GithubIssueDTO>;
  getPull(params: { owner: string; repo: string; pullNumber: number }): Promise<GithubPullRequestDTO>;

  // Comments
  listIssueCommentsForRepo(params: {
    owner: string;
    repo: string;
    sinceIso: string;
  }): Promise<GithubIssueCommentDTO[]>;

  listReviewCommentsForRepo(params: {
    owner: string;
    repo: string;
    sinceIso: string;
  }): Promise<GithubPRReviewCommentDTO[]>;

  // Pull Request commits
  listCommitsForPull(params: {
    owner: string;
    repo: string;
    pullNumber: number;
  }): Promise<GithubCommitDTO[]>;

  // Search
  searchIssuesAndPulls(params: { q: string }): Promise<GithubSearchIssueOrPRDTO[]>;
  searchCommits(params: { q: string }): Promise<GithubSearchCommitDTO[]>;
}


