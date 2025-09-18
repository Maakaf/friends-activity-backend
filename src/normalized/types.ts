export type ISO8601 = string;  // e.g. "2025-09-08T12:34:56Z"
export type RepoId   = string;
export type UserId   = string;
export type IssueId  = string;
export type PullId   = string;
export type CommentId = string;
export type CommitId = string;

/** Enums / literal unions */
export type Visibility = 'public' | 'private';
export type IssueState = 'open' | 'closed';
export type ParentType = 'Issue' | 'PR';

/** Minimal user shape we care about at Silver */
export interface User {
  userId: UserId;          // GitHub user/node id as string
  login: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  htmlUrl?: string | null;
  email?: string | null;
  company?: string | null;
  location?: string | null;
  bio?: string | null;
  blog?: string | null;
  twitterUsername?: string | null;
  publicRepos?: number | null;
  followers?: number | null;
  following?: number | null;
  siteAdmin?: boolean | null;
  type?: string | null;    // GitHub user type (e.g., "User", "Organization")
  fetchedAt?: ISO8601 | null;  // when this user data was fetched from raw layer
  ghCreatedAt?: ISO8601 | null;   // timestamps from GitHub
  ghUpdatedAt?: ISO8601 | null;
}

/** Minimal repo shape we care about at Silver */
export interface Repository {
  repoId: RepoId;                 // GitHub repo id as string
  ownerUserId: UserId | null;     // can be an org (treated as "user" id)
  repoName: string | null;        // name only (not full path)
  description?: string | null;
  htmlUrl?: string | null;
  visibility: Visibility | null;
  defaultBranch?: string | null;
  forkCount?: number | null;
  parentRepoId?: RepoId | null;   // if this is a fork, the parent repo id
  lastActivity?: ISO8601 | null;  // last observed activity time
  fetchedAt?: ISO8601 | null;     // when this repo data was fetched from raw layer
  ghCreatedAt?: ISO8601 | null;
}

/** Issue at Silver (normalized common fields) */
export interface Issue {
  issueId: IssueId;               // provider_event_id for the issue
  repoId: RepoId | null;
  authorUserId: UserId | null;
  assignedUserId?: UserId | null; // single-assignee only at Silver (OK for now)
  state: IssueState;
  createdAt: ISO8601 | null;
  closedAt:  ISO8601 | null;
  updatedAt: ISO8601 | null;
  title?: string | null;
  body?: string | null;
}

/** Pull Request at Silver */
export interface PR {
  prId: PullId;                   // provider_event_id for the PR
  repoId: RepoId | null;
  authorUserId: UserId | null;
  createdAt: ISO8601 | null;
  mergedAt:  ISO8601 | null;
  closedAt:  ISO8601 | null;
  updatedAt: ISO8601 | null;
  title?: string | null;
  body?: string | null;
  commits?: string[];             // Array of commit SHAs included in this PR
}

/**
 * Comment at Silver.
 * Note: parentId refers to the *Issue or PR number/id in the repo’s domain*,
 * not a DB FK. Use parentType to disambiguate.
 */
export interface Comment {
  commentId: CommentId;          // provider_event_id for the comment
  repoId: RepoId | null;
  parentId: IssueId | PullId | null;    // the issue/pr numeric id (as string)
  parentType: ParentType;        // 'Issue' | 'PR'
  authorUserId: UserId | null;
  createdAt: ISO8601 | null;
  updatedAt?: ISO8601 | null;
  body?: string | null;
}

/** Commit at Silver (authored commits only; pushes can be added later) */
export interface Commit {
  commitId: CommitId;            // sha
  repoId: RepoId | null;
  authorUserId: UserId | null;   // GitHub "author" user id if available
  createdAt: ISO8601 | null;     // commit.committer.date from GitHub
  message?: string | null;
}

/** Convenience bundle when returning a full Silver window */
export interface SilverBundle {
  users?:   User[];
  repos?: Repository[];
  issues: Issue[];
  prs: PR[];
  comments: Comment[];
  commits: Commit[];
}
