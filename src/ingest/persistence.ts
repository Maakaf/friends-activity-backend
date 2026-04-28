import type { DataSource, EntityManager } from 'typeorm';
import { AppUserProfileEntity } from '../database/entities/app/user-profile.entity.js';
import { AppRepositoryEntity } from '../database/entities/app/repository.entity.js';
import { AppUserActivityEntity } from '../database/entities/app/user-activity.entity.js';
import { AppUserSyncEntity } from '../database/entities/app/user-sync.entity.js';
import type { UserNode } from './graphql-types.js';
import type { RepoAggregate } from './aggregate.js';

const REPO_BATCH_SIZE = 500;
const ACTIVITY_BATCH_SIZE = 1000;

export async function upsertUserProfile(
  tx: EntityManager,
  user: UserNode,
): Promise<void> {
  await tx
    .createQueryBuilder()
    .insert()
    .into(AppUserProfileEntity)
    .values({
      userId: String(user.databaseId ?? 0),
      login: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
      htmlUrl: user.url,
      company: user.company,
      location: user.location,
      bio: user.bio,
      blog: user.websiteUrl,
      twitterUsername: user.twitterUsername,
      publicRepos: user.repositories.totalCount,
      followers: user.followers.totalCount,
      following: user.following.totalCount,
      type: 'User',
      ghCreatedAt: new Date(user.createdAt),
      fetchedAt: () => 'NOW()',
    })
    .orUpdate(
      [
        'login',
        'name',
        'avatar_url',
        'html_url',
        'company',
        'location',
        'bio',
        'blog',
        'twitter_username',
        'public_repos',
        'followers',
        'following',
        'fetched_at',
      ],
      ['user_id'],
    )
    .execute();
}

export async function upsertRepositories(
  tx: EntityManager,
  perRepo: Map<string, RepoAggregate>,
): Promise<void> {
  const rows = [...perRepo.values()].filter((r) => r.repoDatabaseId);
  if (rows.length === 0) return;

  for (let i = 0; i < rows.length; i += REPO_BATCH_SIZE) {
    const chunk = rows.slice(i, i + REPO_BATCH_SIZE);
    await tx
      .createQueryBuilder()
      .insert()
      .into(AppRepositoryEntity)
      .values(
        chunk.map((r) => ({
          repoId: String(r.repoDatabaseId),
          repoName: r.nameWithOwner,
          description: r.description,
          htmlUrl: r.url,
          forkCount: r.forkCount,
          stargazerCount: r.stargazerCount,
          primaryLanguage: r.primaryLanguage,
          primaryLanguageColor: r.primaryLanguageColor,
          licenseName: r.licenseName,
          licenseSpdx: r.licenseSpdx,
          topics: r.topics,
        })),
      )
      .orUpdate(
        [
          'repo_name',
          'description',
          'html_url',
          'fork_count',
          'stargazer_count',
          'primary_language',
          'primary_language_color',
          'license_name',
          'license_spdx',
          'topics',
        ],
        ['repo_id'],
      )
      .execute();
  }
}

export async function replaceUserActivity(
  tx: EntityManager,
  user: UserNode,
  perRepo: Map<string, RepoAggregate>,
): Promise<void> {
  const userId = String(user.databaseId ?? 0);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  await tx.delete(AppUserActivityEntity, { userId });

  const ACTIVITY_TYPES: Array<[keyof RepoAggregate, string]> = [
    ['commits', 'commit'],
    ['pullRequests', 'pr'],
    ['issues', 'issue'],
    ['issueComments', 'issue_comment'],
    ['prComments', 'pr_comment'],
  ];

  const allRows: Array<{
    userId: string;
    day: Date;
    repoId: string;
    activityType: string;
    activityCount: number;
  }> = [];
  for (const r of perRepo.values()) {
    if (!r.repoDatabaseId) continue;
    const repoId = String(r.repoDatabaseId);
    for (const [field, activityType] of ACTIVITY_TYPES) {
      const count = r[field] as number;
      if (count <= 0) continue;
      allRows.push({
        userId,
        day: today,
        repoId,
        activityType,
        activityCount: count,
      });
    }
  }
  if (allRows.length === 0) return;

  for (let i = 0; i < allRows.length; i += ACTIVITY_BATCH_SIZE) {
    const chunk = allRows.slice(i, i + ACTIVITY_BATCH_SIZE);
    await tx
      .createQueryBuilder()
      .insert()
      .into(AppUserActivityEntity)
      .values(chunk)
      .orUpdate(
        ['activity_count'],
        ['user_id', 'day', 'repo_id', 'activity_type'],
      )
      .execute();
  }
}

export async function markUserReady(
  tx: EntityManager,
  user: UserNode,
): Promise<void> {
  await tx
    .createQueryBuilder()
    .insert()
    .into(AppUserSyncEntity)
    .values({
      login: user.login,
      userId: String(user.databaseId ?? 0),
      status: 'ready',
      lastSyncedAt: () => 'NOW()',
      lastError: null,
      updatedAt: () => 'NOW()',
    })
    .orUpdate(
      ['user_id', 'status', 'last_synced_at', 'last_error', 'updated_at'],
      ['login'],
    )
    .execute();
}

export async function markUserFailed(
  ds: DataSource,
  login: string,
  error: string,
): Promise<void> {
  await ds
    .createQueryBuilder()
    .insert()
    .into(AppUserSyncEntity)
    .values({
      login,
      status: 'failed',
      lastError: error,
      updatedAt: () => 'NOW()',
    })
    .orUpdate(['status', 'last_error', 'updated_at'], ['login'])
    .execute();
}
