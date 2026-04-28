import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GraphqlIngestService } from '../ingest/graphql-ingest.service.js';
import { AppUserProfileEntity } from '../database/entities/app/user-profile.entity.js';
import { AppRepositoryEntity } from '../database/entities/app/repository.entity.js';
import { AppUserActivityEntity } from '../database/entities/app/user-activity.entity.js';
import { AppUserSyncEntity } from '../database/entities/app/user-sync.entity.js';

interface RepoActivityCounts {
  commits: number;
  pullRequests: number;
  issues: number;
  prComments: number;
  issueComments: number;
}

interface UserRepoSummary extends RepoActivityCounts {
  repoName: string | null;
  description: string | null;
  url: string | null;
  primaryLanguage: string | null;
  primaryLanguageColor: string | null;
  stargazerCount: number;
  licenseName: string | null;
  licenseSpdx: string | null;
  topics: string[];
}

interface UserSummaryTotals {
  totalCommits: number;
  totalPRs: number;
  totalIssues: number;
  totalPRComments: number;
  totalIssueComments: number;
}

interface AggregatedActivityRow {
  user_id: string;
  repo_id: string;
  commits: number;
  prs: number;
  issues: number;
  pr_comments: number;
  issue_comments: number;
}

const MIN_FORK_COUNT = 3;
const WINDOW_DAYS = 180;

@Injectable()
export class PipelineV2Service {
  private readonly logger = new Logger(PipelineV2Service.name);

  constructor(
    @InjectRepository(AppUserProfileEntity)
    private readonly userRepo: Repository<AppUserProfileEntity>,
    @InjectRepository(AppRepositoryEntity)
    private readonly repoRepo: Repository<AppRepositoryEntity>,
    @InjectRepository(AppUserActivityEntity)
    private readonly activityRepo: Repository<AppUserActivityEntity>,
    @InjectRepository(AppUserSyncEntity)
    private readonly syncRepo: Repository<AppUserSyncEntity>,
    private readonly ingest: GraphqlIngestService,
  ) {}

  async addNewUsers(users: string[]) {
    this.assertNonEmpty(users);

    const existingRows = await this.syncRepo.find({
      where: { login: In(users) },
      select: ['login'],
    });
    const existingLogins = new Set(existingRows.map((r) => r.login));

    const newUsers: string[] = [];
    const existingUsers: string[] = [];
    for (const u of users) {
      if (existingLogins.has(u)) existingUsers.push(u);
      else newUsers.push(u);
    }

    if (newUsers.length === 0) {
      return {
        message: 'All users already exist',
        successfulUsers: [] as string[],
        failedUsers: [] as string[],
        existingUsers,
      };
    }

    await this.syncRepo
      .createQueryBuilder()
      .insert()
      .values(
        newUsers.map((login) => ({
          login,
          status: 'processing',
          updatedAt: () => 'NOW()',
        })),
      )
      .orUpdate(['status', 'updated_at'], ['login'])
      .execute();

    const results = await this.ingest.ingestUsers(newUsers);
    const successfulUsers = results
      .filter((r) => r.status === 'ready')
      .map((r) => r.login);
    const failedUsers = results
      .filter((r) => r.status !== 'ready')
      .map((r) => r.login);

    return {
      message: 'User processing completed',
      successfulUsers,
      failedUsers,
      existingUsers,
    };
  }

  async removeUsers(users: string[]) {
    this.assertNonEmpty(users);
    const removedUsers: string[] = [];
    const failedUsers: string[] = [];

    for (const login of users) {
      try {
        await this.syncRepo.manager.transaction(async (tx) => {
          const sync = await tx.findOne(AppUserSyncEntity, {
            where: { login },
          });
          const userId = sync?.userId ?? null;
          if (userId) {
            await tx.delete(AppUserActivityEntity, { userId });
            await tx.delete(AppUserProfileEntity, { userId });
          }
          await tx.delete(AppUserSyncEntity, { login });
        });
        removedUsers.push(login);
      } catch (e) {
        this.logger.error(
          `Failed to remove ${login}: ${e instanceof Error ? e.message : String(e)}`,
        );
        failedUsers.push(login);
      }
    }

    return {
      message: 'User removal completed',
      summary: {
        requested: users.length,
        removed: removedUsers.length,
        failed: failedUsers.length,
        skipped: 0,
      },
      removedUsers,
      failedUsers,
      skippedProcessing: [],
    };
  }

  async listUsers() {
    const rows = await this.syncRepo.find({
      select: ['login', 'status'],
      order: { login: 'ASC' },
    });

    const ready = rows.filter((r) => r.status === 'ready').map((r) => r.login);
    const processing = rows
      .filter((r) => r.status === 'processing')
      .map((r) => r.login);
    const pending = rows
      .filter((r) => r.status === 'pending')
      .map((r) => r.login);
    const failed = rows
      .filter((r) => r.status === 'failed')
      .map((r) => r.login);

    return {
      total: rows.length,
      ready: { count: ready.length, users: ready },
      processing: { count: processing.length, users: processing },
      pending: { count: pending.length, users: pending },
      failed: { count: failed.length, users: failed },
    };
  }

  async generateReport(usernames: string[]) {
    this.assertNonEmpty(usernames);

    const since = new Date();
    since.setDate(since.getDate() - WINDOW_DAYS);
    const sinceISO = since.toISOString();
    const todayISO = new Date().toISOString();

    const users = await this.userRepo.find({
      where: { login: In(usernames) },
    });

    const userIds = users.map((u) => u.userId);

    const repos = await this.repoRepo
      .createQueryBuilder('r')
      .where('r.fork_count >= :minForks', { minForks: MIN_FORK_COUNT })
      .getMany();

    const repoIds = repos.map((r) => r.repoId);
    const repoById = new Map(repos.map((r) => [r.repoId, r]));

    const activities: AggregatedActivityRow[] =
      userIds.length === 0 || repoIds.length === 0
        ? []
        : await this.activityRepo
            .createQueryBuilder('a')
            .select('a.user_id', 'user_id')
            .addSelect('a.repo_id', 'repo_id')
            .addSelect(
              `COALESCE(SUM(CASE WHEN a.activity_type = 'commit' THEN a.activity_count ELSE 0 END), 0)::int`,
              'commits',
            )
            .addSelect(
              `COALESCE(SUM(CASE WHEN a.activity_type = 'pr' THEN a.activity_count ELSE 0 END), 0)::int`,
              'prs',
            )
            .addSelect(
              `COALESCE(SUM(CASE WHEN a.activity_type = 'issue' THEN a.activity_count ELSE 0 END), 0)::int`,
              'issues',
            )
            .addSelect(
              `COALESCE(SUM(CASE WHEN a.activity_type = 'pr_comment' THEN a.activity_count ELSE 0 END), 0)::int`,
              'pr_comments',
            )
            .addSelect(
              `COALESCE(SUM(CASE WHEN a.activity_type = 'issue_comment' THEN a.activity_count ELSE 0 END), 0)::int`,
              'issue_comments',
            )
            .where('a.day >= :since', { since: sinceISO })
            .andWhere('a.user_id IN (:...userIds)', { userIds })
            .andWhere('a.repo_id IN (:...repoIds)', { repoIds })
            .groupBy('a.user_id')
            .addGroupBy('a.repo_id')
            .getRawMany<AggregatedActivityRow>();

    const activitiesByUser = new Map<string, AggregatedActivityRow[]>();
    for (const a of activities) {
      const arr = activitiesByUser.get(a.user_id);
      if (arr) arr.push(a);
      else activitiesByUser.set(a.user_id, [a]);
    }

    const usersOut = users.map((u) => {
      const userRepos = this.buildUserRepos(
        activitiesByUser.get(u.userId) ?? [],
        repoById,
      );
      return {
        user: {
          username: u.login,
          displayName: u.name,
          avatarUrl: u.avatarUrl,
          bio: u.bio,
          location: u.location,
          company: u.company,
          blog: u.blog,
          twitterUsername: u.twitterUsername,
          publicRepos: u.publicRepos,
          followers: u.followers,
          following: u.following,
          accountType: u.type,
          createdAt: u.ghCreatedAt?.toISOString(),
        },
        repos: userRepos,
        summary: this.calculateUserSummary(userRepos),
      };
    });

    const globalSummary = this.buildGlobalSummary(
      activities,
      usersOut.length,
      sinceISO,
      todayISO,
    );

    return { users: usersOut, globalSummary, excludedUsers: [] };
  }

  private buildUserRepos(
    userActivities: AggregatedActivityRow[],
    repoById: Map<string, AppRepositoryEntity>,
  ): UserRepoSummary[] {
    const out: UserRepoSummary[] = [];
    for (const a of userActivities) {
      const r = repoById.get(a.repo_id);
      if (!r) continue;
      out.push({
        repoName: r.repoName,
        description: r.description,
        url: r.htmlUrl,
        primaryLanguage: r.primaryLanguage,
        primaryLanguageColor: r.primaryLanguageColor,
        stargazerCount: r.stargazerCount,
        licenseName: r.licenseName,
        licenseSpdx: r.licenseSpdx,
        topics: r.topics ?? [],
        commits: a.commits,
        pullRequests: a.prs,
        issues: a.issues,
        prComments: a.pr_comments,
        issueComments: a.issue_comments,
      });
    }
    return out;
  }

  private calculateUserSummary(repos: UserRepoSummary[]): UserSummaryTotals {
    return repos.reduce<UserSummaryTotals>(
      (s, r) => ({
        totalCommits: s.totalCommits + r.commits,
        totalPRs: s.totalPRs + r.pullRequests,
        totalIssues: s.totalIssues + r.issues,
        totalPRComments: s.totalPRComments + r.prComments,
        totalIssueComments: s.totalIssueComments + r.issueComments,
      }),
      {
        totalCommits: 0,
        totalPRs: 0,
        totalIssues: 0,
        totalPRComments: 0,
        totalIssueComments: 0,
      },
    );
  }

  private buildGlobalSummary(
    activities: AggregatedActivityRow[],
    totalUsers: number,
    sinceISO: string,
    todayISO: string,
  ) {
    const totals = activities.reduce(
      (s, a) => ({
        totalCommits: s.totalCommits + a.commits,
        totalPRs: s.totalPRs + a.prs,
        totalIssues: s.totalIssues + a.issues,
        totalPRComments: s.totalPRComments + a.pr_comments,
        totalIssueComments: s.totalIssueComments + a.issue_comments,
      }),
      {
        totalCommits: 0,
        totalPRs: 0,
        totalIssues: 0,
        totalPRComments: 0,
        totalIssueComments: 0,
      },
    );

    const uniqueRepos = new Set(activities.map((a) => a.repo_id));

    return {
      ...totals,
      totalRepos: uniqueRepos.size,
      successfulUsers: totalUsers,
      failedUsers: 0,
      totalUsers,
      analysisTimeframe: `${sinceISO.slice(0, 10)} to ${todayISO.slice(0, 10)}`,
      minForkCountFilter: String(MIN_FORK_COUNT),
    };
  }

  private assertNonEmpty(users: string[]): void {
    if (!Array.isArray(users) || users.length === 0) {
      throw new BadRequestException('users must be a non-empty array');
    }
  }
}
