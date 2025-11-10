import {
  Issue, PR, Comment, Commit,
  Repository, User, IssueState, ParentType, RepoId, UserId, ISO8601, Visibility
} from './types.js';
import type { RawPayload } from '../raw/raw-saver.js';

type GithubUserPayload = RawPayload & {
  id?: number | string | null;
  login?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  html_url?: string | null;
  email?: string | null;
  company?: string | null;
  location?: string | null;
  bio?: string | null;
  blog?: string | null;
  twitter_username?: string | null;
  public_repos?: number | null;
  followers?: number | null;
  following?: number | null;
  site_admin?: boolean | null;
  type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type GithubIssuePayload = RawPayload & {
  id?: number | string | null;
  state?: string | null;
  created_at?: string | null;
  user?: GithubUserPayload | null;
  assignee?: GithubUserPayload | null;
  closed_at?: string | null;
  updated_at?: string | null;
  title?: string | null;
  body?: string | null;
};

type GithubPullRequestPayload = GithubIssuePayload & {
  pull_request?: { merged_at?: string | null } | null;
  merged_at?: string | null;
  number?: number | null;
};

type GithubCommentPayload = RawPayload & {
  id?: number | string | null;
  user?: GithubUserPayload | null;
  created_at?: string | null;
  updated_at?: string | null;
  body?: string | null;
};

type GithubCommitPayload = RawPayload & {
  sha?: string | null;
  author?: GithubUserPayload | null;
  commit?: {
    committer?: { date?: string | null } | null;
    message?: string | null;
  } | null;
};

type GithubRepoPayload = RawPayload & {
  id?: number | string | null;
  owner?: GithubUserPayload | null;
  name?: string | null;
  description?: string | null;
  html_url?: string | null;
  visibility?: string | null;
  private?: boolean | null;
  default_branch?: string | null;
  forks_count?: number | null;
  parent?: { id?: number | string | null } | null;
  pushed_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type GithubActorPayload = RawPayload & {
  user?: GithubUserPayload | null;
  author?: GithubUserPayload | null;
  comment?: { user?: GithubUserPayload | null } | null;
  assignees?: (GithubUserPayload | null | undefined)[] | null;
  requested_reviewers?: (GithubUserPayload | null | undefined)[] | null;
};

export interface BronzeRow {
  event_ulid: string;
  provider: string;               // 'bronzeLayer'
  event_type: 'issue' | 'pull_request' | 'issue_comment' | 'pr_review_comment' | 'commit' | string;
  provider_event_id: string | null;
  actor_user_node: string | null; // user id as string
  repo_node: string | null;       // repo id as string
  target_node: string | null;     // parent issue/PR id for comments
  created_at: string | null;      // ISO
  received_at: string | null;     // ISO
  is_private: boolean | null;
  raw_payload: RawPayload | null;               // GitHub REST payload
}

/* ---------- Issues ---------- */
/** Map ONE bronze row (issue) -> Silver Issue. Returns null if no id is found. */
export function mapIssue(b: BronzeRow): Issue | null {
  if (b.event_type !== 'issue') return null;

  const rp = (b.raw_payload as GithubIssuePayload | null) ?? {};
  const id = b.provider_event_id ?? rp.id;
  if (id == null) return null;

  const state: IssueState = rp.state === 'closed' ? 'closed' : 'open';
  const createdAt: ISO8601 | null = b.created_at ?? rp.created_at ?? null;

  return {
    issueId: String(id),
    repoId: b.repo_node ?? null,
    authorUserId: rp.user?.id != null ? String(rp.user.id) : (b.actor_user_node ?? null),
    assignedUserId: rp.assignee?.id != null ? String(rp.assignee.id) : null,
    state,
    createdAt,
    closedAt: rp.closed_at ?? null,
    updatedAt: rp.updated_at ?? null,
    title: rp.title ?? null,
    body: rp.body ?? null,
  };
}

/** Merge strategy when the same issue appears multiple times. Prefer the fresher row. */
export function mergeIssue(prev: Issue, next: Issue): Issue {
  const prevT = prev.updatedAt ?? prev.createdAt ?? null;
  const nextT = next.updatedAt ?? next.createdAt ?? null;
  const useNext = !prevT || (nextT != null && nextT > prevT);

  if (!useNext) return prev;

  return {
    ...prev,
    ...next,
    // keep non-null titles/bodies if the fresher row doesn’t have them
    title: next.title ?? prev.title ?? null,
    body:  next.body  ?? prev.body  ?? null,
  };
}

/* ---------- PRs ---------- */
export function mapPR(b: BronzeRow): PR | null {
  if (b.event_type !== 'pull_request') return null;

  const rp = (b.raw_payload as GithubPullRequestPayload | null) ?? {};
  const id = b.provider_event_id ?? rp.id;
  if (id == null) return null;

  const createdAt: ISO8601 | null = b.created_at ?? rp.created_at ?? null;
  
  return {
    prId: String(id),
    repoId: b.repo_node ?? null,
    authorUserId: rp.user?.id != null ? String(rp.user.id) : (b.actor_user_node ?? null),
    createdAt,
    mergedAt: rp.merged_at ?? rp.pull_request?.merged_at ?? null,
    closedAt: rp.closed_at ?? null,
    updatedAt: rp.updated_at ?? null,
    title: rp.title ?? null,
    body: rp.body ?? null,
    commits: [], // Will be populated later with commit SHAs
  };
}

/** Keep the fresher snapshot (by updatedAt/createdAt) and carry non-null fields forward. 
 * Prioritize PRs with commits over empty ones. */
export function mergePR(prev: PR, next: PR): PR {
  const prevT = prev.updatedAt ?? prev.createdAt ?? null;
  const nextT = next.updatedAt ?? next.createdAt ?? null;
  const useNext = !prevT || (nextT != null && nextT > prevT);

  // If one has commits and the other doesn't, prefer the one with commits
  const prevHasCommits = prev.commits && prev.commits.length > 0;
  const nextHasCommits = next.commits && next.commits.length > 0;
  
  if (prevHasCommits && !nextHasCommits) {
    // Keep prev even if it's older, but update other fields from next
    return {
      ...next,
      ...prev,
      title: next.title ?? prev.title ?? null,
      body:  next.body  ?? prev.body  ?? null,
      commits: prev.commits, // Keep the commits from prev
    };
  }
  
  if (!prevHasCommits && nextHasCommits) {
    // Use next since it has commits
    return {
      ...prev,
      ...next,
      title: next.title ?? prev.title ?? null,
      body:  next.body  ?? prev.body  ?? null,
      commits: next.commits,
    };
  }

  // Both have commits or both are empty, use timestamp logic
  if (!useNext) return prev;

  return {
    ...prev,
    ...next,
    title: next.title ?? prev.title ?? null,
    body:  next.body  ?? prev.body  ?? null,
    commits: next.commits ?? prev.commits ?? [],
  };
}


/* ---------- Comments ---------- */
/** Map ONE bronze row (issue_comment or pr_review_comment) -> Silver Comment. */
export function mapComment(b: BronzeRow): Comment | null {
  if (b.event_type !== 'issue_comment' && b.event_type !== 'pr_review_comment') return null;

  const rp = (b.raw_payload as GithubCommentPayload | null) ?? {};
  const id = b.provider_event_id ?? rp.id;
  if (id == null) return null;

  // Decide parent type
  const parentType: ParentType = b.event_type === 'issue_comment' ? 'Issue' : 'PR';

  return {
    commentId: String(id),
    repoId: b.repo_node ?? null,
    parentId: b.target_node ?? null,   // Bronze stored issue/PR id in target_node
    parentType,
    authorUserId: rp.user?.id != null ? String(rp.user.id) : (b.actor_user_node ?? null),
    createdAt: b.created_at ?? rp.created_at ?? null,
    updatedAt: rp.updated_at ?? null,
    body: rp.body ?? null,
  };
}

/** Merge comments: keep freshest updatedAt, but don’t lose body. */
export function mergeComment(prev: Comment, next: Comment): Comment {
  const prevT = prev.updatedAt ?? prev.createdAt ?? null;
  const nextT = next.updatedAt ?? next.createdAt ?? null;
  const useNext = !prevT || (nextT != null && nextT > prevT);

  if (!useNext) return prev;

  return {
    ...prev,
    ...next,
    body: next.body ?? prev.body ?? null,
  };
}

/* ---------- Commits ---------- */
export function mapCommit(b: BronzeRow): Commit | null {
  if (b.event_type !== 'commit') return null;

  const rp = (b.raw_payload as GithubCommitPayload | null) ?? {};
  const id = b.provider_event_id ?? rp.sha;
  if (!id) return null;

  // author can be null on GitHub for unlinked emails; fall back to actor_user_node
  const authorUserId =
    rp.author?.id != null ? String(rp.author.id) :
    (b.actor_user_node ?? null);

  const createdAt: ISO8601 | null =
    b.created_at ??
    rp.commit?.committer?.date ??
    null;

  return {
    commitId: String(id),
    repoId: b.repo_node ?? null,
    authorUserId,
    createdAt,
    message: rp.commit?.message ?? null,
  };
}

/** Commits are immutable by SHA; if dupes appear, keep the one with a message / latest timestamp. */
export function mergeCommit(prev: Commit, next: Commit): Commit {
  // Prefer whichever has createdAt; if both, prefer the later one.
  const prevT = prev.createdAt ?? null;
  const nextT = next.createdAt ?? null;
  const useNext = (!prevT && !!nextT) || (!!prevT && !!nextT && nextT > prevT);

  if (!useNext) {
    // Carry message forward if prev lacks it
    if (!prev.message && next.message) {
      return { ...prev, message: next.message };
    }
    return prev;
  }

  return {
    ...prev,
    ...next,
    message: next.message ?? prev.message ?? null,
  };
}


/** Map a GitHub user-ish JSON to Silver User. */
export function mapUserFromPayload(u: GithubUserPayload | null | undefined): User | null {
  if (!u || u.id == null) return null;
  return {
    userId: String(u.id),
    login: u.login ?? null,
    name: u.name ?? null,
    avatarUrl: u.avatar_url ?? null,
    htmlUrl: u.html_url ?? null,
    email: u.email ?? null,
    company: u.company ?? null,
    location: u.location ?? null,
    bio: u.bio ?? null,
    blog: u.blog ?? null,
    twitterUsername: u.twitter_username ?? null,
    publicRepos: u.public_repos ?? null,
    followers: u.followers ?? null,
    following: u.following ?? null,
    siteAdmin: u.site_admin ?? null,
    type: u.type ?? null,
    ghCreatedAt: u.created_at ?? null,
    ghUpdatedAt: u.updated_at ?? null,
  };
}

/** Map directly from bronze.github_users row */
export function mapUserFromBronzeRow(row: {
  user_node: string;
  login: string | null;
  fetched_at: string | null;
  raw_payload: RawPayload | null;
}): User | null {
  const fromPayload = mapUserFromPayload(row.raw_payload as GithubUserPayload | null);
  if (fromPayload) {
    return {
      ...fromPayload,
      fetchedAt: row.fetched_at,
    };
  }

  // fallback minimal mapping if payload is missing or empty
  return {
    userId: String(row.user_node),
    login: row.login ?? null,
    fetchedAt: row.fetched_at,
    name: null,
    avatarUrl: null,
    htmlUrl: null,
    email: null,
    company: null,
    location: null,
    bio: null,
    siteAdmin: null,
    type: null,
    ghCreatedAt: null,
    ghUpdatedAt: null,
  };
}

/**
 * Given a bronze row payload and an actor id, try to find a matching
 * user object for that actor in common locations; otherwise return { id }.
 */
export function pickUserObjectForActor(raw_payload: GithubActorPayload | null | undefined, actorId: string): GithubUserPayload {
  const idEq = (u: GithubUserPayload | null | undefined) => u && u.id != null && String(u.id) === actorId;

  const candidates: GithubUserPayload[] = [];
  if (raw_payload?.user) candidates.push(raw_payload.user);
  if (raw_payload?.author) candidates.push(raw_payload.author);
  if (raw_payload?.comment?.user) candidates.push(raw_payload.comment.user);
  if (Array.isArray(raw_payload?.assignees)) candidates.push(...raw_payload.assignees.filter(Boolean) as GithubUserPayload[]);
  if (Array.isArray(raw_payload?.requested_reviewers)) candidates.push(...raw_payload.requested_reviewers.filter(Boolean) as GithubUserPayload[]);

  const found = candidates.find(idEq);
  if (found) return found;

  // fallback minimal skeleton; you can enrich later by login/REST call
  return { id: actorId };
}

/** Merge: prefer newer ghUpdatedAt/ghCreatedAt; coalesce non-null fields. */
export function mergeUser(prev: User, next: User): User {
  const prevT = prev.ghUpdatedAt ?? prev.ghCreatedAt ?? null;
  const nextT = next.ghUpdatedAt ?? next.ghCreatedAt ?? null;
  const preferNext = (!prevT && !!nextT) || (!!prevT && !!nextT && nextT > prevT);

  const pick = <T>(a: T | null | undefined, b: T | null | undefined): T | null =>
    (b ?? a ?? null);

  const base = preferNext ? { ...prev, ...next } : { ...next, ...prev };

  return {
    ...base,
    login:       pick(prev.login,       next.login),
    name:        pick(prev.name,        next.name),
    avatarUrl:   pick(prev.avatarUrl,   next.avatarUrl),
    htmlUrl:     pick(prev.htmlUrl,     next.htmlUrl),
    email:       pick(prev.email,       next.email),
    company:     pick(prev.company,     next.company),
    location:    pick(prev.location,    next.location),
    bio:         pick(prev.bio,         next.bio),
    siteAdmin:   pick(prev.siteAdmin,   next.siteAdmin),
    type:        pick(prev.type,        next.type),
    fetchedAt:   pick(prev.fetchedAt,   next.fetchedAt),
    ghCreatedAt: pick(prev.ghCreatedAt, next.ghCreatedAt),
    ghUpdatedAt: pick(prev.ghUpdatedAt, next.ghUpdatedAt),
  };
}


/** Map a GitHub repo JSON payload to Silver Repository shape */
export function mapRepositoryFromPayload(r: GithubRepoPayload | null | undefined): Repository | null {
  if (!r || r.id == null) return null;

  const repoId: RepoId = String(r.id);
  const ownerUserId: UserId | null = r.owner?.id != null ? String(r.owner.id) : null;

  const visibility: Visibility | null =
    typeof r.visibility === 'string'
      ? (r.visibility as Visibility)
      : r.private === true
      ? 'private'
      : r.private === false
      ? 'public'
      : null;

  const lastActivity: ISO8601 | null = r.pushed_at ?? r.updated_at ?? null;

  return {
    repoId,
    ownerUserId,
    repoName: r.name ?? null,
    description: r.description ?? null,
    htmlUrl: r.html_url ?? null,
    visibility,
    defaultBranch: r.default_branch ?? null,
    forkCount: typeof r.forks_count === 'number' ? r.forks_count : null,
    parentRepoId: r.parent?.id ? String(r.parent.id) : null,
    lastActivity,
    ghCreatedAt: r.created_at ?? null,
  };
}

/** Map directly from bronze.github_repos row */
export function mapRepoFromBronzeRow(row: {
  repo_node: string;
  name: string | null;
  is_private: boolean | null;
  fetched_at: string | null;
  raw_payload: RawPayload | null;
}): Repository | null {
  const fromPayload = mapRepositoryFromPayload(row.raw_payload as GithubRepoPayload | null);
  if (fromPayload) {
    return {
      ...fromPayload,
      fetchedAt: row.fetched_at,
    };
  }

  // fallback minimal mapping if payload is missing or empty
  return {
    repoId: String(row.repo_node),
    ownerUserId: null,
    repoName: row.name ?? null,
    visibility:
      row.is_private === true
        ? 'private'
        : row.is_private === false
        ? 'public'
        : null,
    defaultBranch: null,
    forkCount: null,
    parentRepoId: null,
    lastActivity: null,
    fetchedAt: row.fetched_at,
    ghCreatedAt: null,
  };
}
