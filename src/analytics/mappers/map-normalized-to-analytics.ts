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
    blog: u.blog ?? null,
    twitterUsername: u.twitterUsername ?? null,
    publicRepos: u.publicRepos ?? null,
    followers: u.followers ?? null,
    following: u.following ?? null,
    type: u.type ?? null,
    siteAdmin: u.siteAdmin ?? null,
    ghCreatedAt: u.ghCreatedAt ? new Date(u.ghCreatedAt) : null,
    ghUpdatedAt: u.ghUpdatedAt ? new Date(u.ghUpdatedAt) : null,
    fetchedAt: u.fetchedAt ? new Date(u.fetchedAt) : new Date(),
  }));

  /* ---------- curated.repository ---------- */
  const repoEntities: RepositoryEntity[] = (repos ?? []).map(r => ({
    repoId: r.repoId,
    ownerUserId: r.ownerUserId ?? null,
    repoName: r.repoName ?? null,
    description: r.description ?? null,
    htmlUrl: r.htmlUrl ?? null,
    visibility: r.visibility ?? null,
    defaultBranch: r.defaultBranch ?? null,
    forkCount: r.forkCount ?? null,
    lastActivity: r.lastActivity ? new Date(r.lastActivity) : null,
    ghCreatedAt: r.ghCreatedAt ? new Date(r.ghCreatedAt) : null,
    // fetchedAt: r.fetchedAt ? new Date(r.fetchedAt) : null,

  }));

  /* ---------- curated.user_activity ---------- */
  const activityMap = new Map<string, UserActivityEntity>();

  const addActivity = (userId: string | null, repoId: string | null, dateIso: string | null, type: string) => {
    if (!userId || !repoId || !dateIso) return;
    
    const day = toDate(dateIso);
    if (!day) return;
    
    const dayStr = day.toISOString().split('T')[0];
    const key = `${userId}-${dayStr}-${repoId}-${type}`;
    
    const existing = activityMap.get(key);
    if (existing) {
      existing.activityCount = (existing.activityCount || 0) + 1;
    } else {
      activityMap.set(key, {
        userId,
        day,
        repoId,
        activityType: type,
        activityCount: 1,
      });
    }
  };

  issues.forEach(i   => addActivity(i.authorUserId, i.repoId, i.createdAt, 'issue'));
  prs.forEach(p      => addActivity(p.authorUserId, p.repoId, p.createdAt, 'pr'));
  comments.forEach(c => {
    const commentType = c.parentType === 'PR' ? 'pr_comment' : 'issue_comment';
    addActivity(c.authorUserId, c.repoId, c.createdAt, commentType);
  });
  commits.forEach(c  => addActivity(c.authorUserId, c.repoId, c.createdAt, 'commit'));

  // Final deduplication step to prevent constraint violations
  const uniqueActivities = new Map<string, UserActivityEntity>();
  Array.from(activityMap.values()).forEach(activity => {
    const key = `${activity.userId}-${activity.day?.toISOString().split('T')[0]}-${activity.repoId}-${activity.activityType}`;
    const existing = uniqueActivities.get(key);
    if (existing) {
      existing.activityCount = (existing.activityCount || 0) + (activity.activityCount || 0);
    } else {
      uniqueActivities.set(key, { ...activity });
    }
  });
  
  const activities = Array.from(uniqueActivities.values());

  return { profiles, activities, repos: repoEntities };
}

// helper converter
function toDate(iso: string | null): Date | null {
  return iso ? new Date(iso) : null;
}
