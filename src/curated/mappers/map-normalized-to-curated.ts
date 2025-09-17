import type { SilverBundle } from '../../normalized/types.js';
import { UserProfileEntity } from '../user_profile/user_profile.entity.js';
import { UserActivityEntity } from '../user_activity/user_activity.entity.js';
import { RepositoryEntity } from '../repository/repository.entity.js';

/**
 * Convert a SilverBundle (all normalized data) into arrays
 * of entities ready for insertion into the curated tables.
 */
export function mapSilverToCurated(bundle: SilverBundle): {
  profiles: UserProfileEntity[];
  activities: UserActivityEntity[];
  repos: RepositoryEntity[];
} {
  const {
    users = [],
    repos = [],
    issues = [],
    prs = [],
    comments = [],
    commits = [],
  } = bundle;

  /* ---------- gold.user_profile ---------- */
  const profiles = (users ?? []).map(u => ({
    userId: u.userId,
    login: u.login,
    name: u.name ?? null,
    avatarUrl: u.avatarUrl ?? null,
    htmlUrl: u.htmlUrl ?? null,
    email: u.email ?? null,
    company: u.company ?? null,
    location: u.location ?? null,
    bio: u.bio ?? null,
    // type: u.type ?? null - add in silver types (User), for now null
    type: 'fix needed',
    siteAdmin: u.siteAdmin ?? null,
    ghCreatedAt: u.ghCreatedAt ? new Date(u.ghCreatedAt) : null,
    ghUpdatedAt: u.ghUpdatedAt ? new Date(u.ghUpdatedAt) : null,
    fetchedAt: new Date(),
  }));

  /* ---------- curated.repository ---------- */
  const repoEntities: RepositoryEntity[] = (repos ?? []).map(r => ({
    repoId: r.repoId,
    ownerUserId: r.ownerUserId ?? null,
    repoName: r.repoName ?? null,
    visibility: r.visibility ?? null,
    defaultBranch: r.defaultBranch ?? null,
    forkCount: r.forkCount ?? null,
    lastActivity: r.lastActivity ? new Date(r.lastActivity) : null,
    ghCreatedAt: r.ghCreatedAt ? new Date(r.ghCreatedAt) : null,
    fetchedAt: new Date(),

  }));

  /* ---------- curated.user_activity ---------- */
  const activities: UserActivityEntity[] = [];

  const addActivity = (userId: string | null, repoId: string | null, dateIso: string | null, type: string) => {
    activities.push({
      userId,
      day: toDate(dateIso),
      repoId,
      activityType: type,
      activityCount: 1,
    });
  };

  issues.forEach(i   => addActivity(i.authorUserId, i.repoId, i.createdAt, 'issue'));
  prs.forEach(p      => addActivity(p.authorUserId, p.repoId, p.createdAt, 'pr'));
  comments.forEach(c => addActivity(c.authorUserId, c.repoId, c.createdAt, 'comment'));
  commits.forEach(c  => addActivity(c.authorUserId, c.repoId, c.createdAt, 'commit'));

  return { profiles, activities, repos: repoEntities };
}

// helper converter
function toDate(iso: string | null): Date | null {
  return iso ? new Date(iso) : null;
}
