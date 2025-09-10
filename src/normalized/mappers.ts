import {
  Issue, PR, Comment, Commit,
  Repository, User, IssueState, ParentType, RepoId, UserId, ISO8601
} from './types.js';

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
  raw_payload: any;               // GitHub REST payload
}

/* ---------- Issues ---------- */
/** Map ONE bronze row (issue) -> Silver Issue. Returns null if no id is found. */
export function mapIssue(b: BronzeRow): Issue | null {
  if (b.event_type !== 'issue') return null;

  const rp = b.raw_payload ?? {};
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

  const rp = b.raw_payload ?? {};
  const id = b.provider_event_id ?? rp.id;
  if (id == null) return null;

  const createdAt: ISO8601 | null = b.created_at ?? rp.created_at ?? null;

  return {
    prId: String(id),
    repoId: b.repo_node ?? null,
    authorUserId: rp.user?.id != null ? String(rp.user.id) : (b.actor_user_node ?? null),
    createdAt,
    mergedAt: rp.merged_at ?? null,
    closedAt: rp.closed_at ?? null,
    updatedAt: rp.updated_at ?? null,
    title: rp.title ?? null,
    body: rp.body ?? null,
  };
}

/** Keep the fresher snapshot (by updatedAt/createdAt) and carry non-null fields forward. */
export function mergePR(prev: PR, next: PR): PR {
  const prevT = prev.updatedAt ?? prev.createdAt ?? null;
  const nextT = next.updatedAt ?? next.createdAt ?? null;
  const useNext = !prevT || (nextT != null && nextT > prevT);

  if (!useNext) return prev;

  return {
    ...prev,
    ...next,
    title: next.title ?? prev.title ?? null,
    body:  next.body  ?? prev.body  ?? null,
  };
}
