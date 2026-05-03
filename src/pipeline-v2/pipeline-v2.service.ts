import { readFile } from 'fs/promises';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { GraphqlIngestService } from '../ingest/graphql-ingest.service.js';
import {
  upsertUserProfile,
  upsertRepositories,
  replaceUserActivity,
  replaceUserDailyContributions,
  markUserReady,
} from '../ingest/persistence.js';
import { MIN_FORK_COUNT } from '../ingest/constants.js';
import { AppUserProfileEntity } from '../database/entities/app/user-profile.entity.js';
import { AppRepositoryEntity } from '../database/entities/app/repository.entity.js';
import { AppUserActivityEntity } from '../database/entities/app/user-activity.entity.js';
import { AppUserSyncEntity } from '../database/entities/app/user-sync.entity.js';
import { AppUserDailyContributionEntity } from '../database/entities/app/user-daily-contribution.entity.js';

interface RepoActivityCounts {
  commits: number;
  pullRequests: number;
  issues: number;
  prReviews: number;
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
  totalPRReviews: number;
  totalPRComments: number;
  totalIssueComments: number;
}

interface AggregatedActivityRow {
  user_id: string;
  repo_id: string;
  commits: number;
  prs: number;
  issues: number;
  pr_reviews: number;
  pr_comments: number;
  issue_comments: number;
}

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
    @InjectRepository(AppUserDailyContributionEntity)
    private readonly dailyRepo: Repository<AppUserDailyContributionEntity>,
    private readonly ingest: GraphqlIngestService,
  ) {}

  async refreshAll() {
    const usersJson = await readFile(join(process.cwd(), 'users.json'), 'utf-8');
    const users: string[] = JSON.parse(usersJson);
    this.logger.log(`Refreshing ${users.length} users from users.json`);

    // Phase 1: fetch all from GitHub concurrently (no DB writes yet)
    const fetched = await Promise.all(
      users.map((login) => this.ingest.fetchUser(login)),
    );

    const successful = fetched.filter((r) => r.status === 'ready');
    const failed = fetched.filter((r) => r.status !== 'ready');

    // Phase 2: single atomic transaction — wipe everything + write all results
    await this.syncRepo.manager.transaction(async (tx) => {
      await tx.clear(AppUserActivityEntity);
      await tx.clear(AppUserDailyContributionEntity);
      await tx.clear(AppUserProfileEntity);
      await tx.clear(AppUserSyncEntity);
      await tx.clear(AppRepositoryEntity);

      for (const r of successful) {
        if (r.status !== 'ready') continue;
        await upsertUserProfile(tx, r.user);
        await upsertRepositories(tx, r.perRepo);
        await replaceUserActivity(tx, r.user, r.perRepo);
        await replaceUserDailyContributions(tx, r.user, r.dailyCounts);
        await markUserReady(tx, r.user);
      }

      for (const r of failed) {
        await tx
          .createQueryBuilder()
          .insert()
          .into(AppUserSyncEntity)
          .values({
            login: r.login,
            status: r.status,
            lastError: r.error,
            updatedAt: () => 'NOW()',
          })
          .orUpdate(['status', 'last_error', 'updated_at'], ['login'])
          .execute();
      }
    });

    return {
      message: 'Refresh completed',
      successfulUsers: successful.map((r) => r.login),
      failedUsers: failed.map((r) => r.login),
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

  async generateReport() {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - WINDOW_DAYS);
    const sinceISO = since.toISOString();
    const todayISO = new Date().toISOString();

    const readyLogins = await this.syncRepo
      .find({ where: { status: 'ready' }, select: ['login'] })
      .then((rows) => rows.map((r) => r.login));

    const users =
      readyLogins.length > 0
        ? await this.userRepo.find({ where: { login: In(readyLogins) } })
        : [];

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
              `COALESCE(SUM(CASE WHEN a.activity_type = 'pr_review' THEN a.activity_count ELSE 0 END), 0)::int`,
              'pr_reviews',
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

    const dailyRows =
      userIds.length === 0
        ? []
        : await this.dailyRepo.find({
            where: { userId: In(userIds), day: MoreThanOrEqual(since) },
            order: { day: 'ASC' },
          });
    const dailyByUser = new Map<
      string,
      Array<{ date: string; count: number }>
    >();
    for (const d of dailyRows) {
      const arr = dailyByUser.get(d.userId);
      const dateStr =
        typeof d.day === 'string' ? d.day : d.day.toISOString().slice(0, 10);
      const entry = { date: dateStr, count: d.count };
      if (arr) arr.push(entry);
      else dailyByUser.set(d.userId, [entry]);
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
        dailyContributions: dailyByUser.get(u.userId) ?? [],
      };
    });

    const globalSummary = this.buildGlobalSummary(
      activities,
      usersOut.length,
      sinceISO,
      todayISO,
    );

    const contributorsByRepoId = new Map<
      string,
      Array<{ login: string; avatarUrl: string | null }>
    >();
    const userInfoById = new Map(
      users.map((u) => [u.userId, { login: u.login, avatarUrl: u.avatarUrl }]),
    );
    for (const a of activities) {
      const info = userInfoById.get(a.user_id);
      if (!info) continue;
      let arr = contributorsByRepoId.get(a.repo_id);
      if (!arr) {
        arr = [];
        contributorsByRepoId.set(a.repo_id, arr);
      }
      if (!arr.some((c) => c.login === info.login)) {
        arr.push(info);
      }
    }

    const repoLeaderboard = await this.buildRepoLeaderboard(
      userIds,
      sinceISO,
      contributorsByRepoId,
    );

    const dailyTotals = this.buildCommunityTimeline(dailyRows);

    return {
      users: usersOut,
      globalSummary,
      repoLeaderboard,
      dailyTotals,
      excludedUsers: [],
    };
  }

  private buildCommunityTimeline(
    dailyRows: AppUserDailyContributionEntity[],
  ): Array<{ date: string; count: number }> {
    const byDay = new Map<string, number>();
    for (const d of dailyRows) {
      const date =
        typeof d.day === 'string' ? d.day : d.day.toISOString().slice(0, 10);
      byDay.set(date, (byDay.get(date) || 0) + d.count);
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
  }

  private async buildRepoLeaderboard(
    userIds: string[],
    sinceISO: string,
    contributorsByRepoId: Map<
      string,
      Array<{ login: string; avatarUrl: string | null }>
    >,
  ) {
    if (userIds.length === 0) return [];

    interface RepoLeaderboardRow {
      repo_id: string;
      repo_name: string;
      description: string | null;
      html_url: string | null;
      fork_count: number;
      stargazer_count: number | null;
      primary_language: string | null;
      primary_language_color: string | null;
      license_name: string | null;
      license_spdx: string | null;
      topics: string[] | null;
      commits: number;
      prs: number;
      issues: number;
      pr_reviews: number;
      pr_comments: number;
      issue_comments: number;
      contributors: number;
    }

    const rows: RepoLeaderboardRow[] = await this.activityRepo
      .createQueryBuilder('a')
      .innerJoin(
        AppRepositoryEntity,
        'r',
        'r.repo_id = a.repo_id AND r.fork_count >= :minForks',
        { minForks: MIN_FORK_COUNT },
      )
      .select('r.repo_id', 'repo_id')
      .addSelect('r.repo_name', 'repo_name')
      .addSelect('r.description', 'description')
      .addSelect('r.html_url', 'html_url')
      .addSelect('r.fork_count', 'fork_count')
      .addSelect('r.stargazer_count', 'stargazer_count')
      .addSelect('r.primary_language', 'primary_language')
      .addSelect('r.primary_language_color', 'primary_language_color')
      .addSelect('r.license_name', 'license_name')
      .addSelect('r.license_spdx', 'license_spdx')
      .addSelect('r.topics', 'topics')
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
        `COALESCE(SUM(CASE WHEN a.activity_type = 'pr_review' THEN a.activity_count ELSE 0 END), 0)::int`,
        'pr_reviews',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN a.activity_type = 'pr_comment' THEN a.activity_count ELSE 0 END), 0)::int`,
        'pr_comments',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN a.activity_type = 'issue_comment' THEN a.activity_count ELSE 0 END), 0)::int`,
        'issue_comments',
      )
      .addSelect('COUNT(DISTINCT a.user_id)::int', 'contributors')
      .where('a.day >= :since', { since: sinceISO })
      .andWhere('a.user_id IN (:...userIds)', { userIds })
      .groupBy('r.repo_id')
      .addGroupBy('r.repo_name')
      .addGroupBy('r.description')
      .addGroupBy('r.html_url')
      .addGroupBy('r.fork_count')
      .addGroupBy('r.stargazer_count')
      .addGroupBy('r.primary_language')
      .addGroupBy('r.primary_language_color')
      .addGroupBy('r.license_name')
      .addGroupBy('r.license_spdx')
      .addGroupBy('r.topics')
      .getRawMany<RepoLeaderboardRow>();

    return rows
      .map((r) => ({
        repoName: r.repo_name,
        description: r.description,
        url: r.html_url,
        forkCount: r.fork_count,
        stargazerCount: r.stargazer_count ?? 0,
        primaryLanguage: r.primary_language,
        primaryLanguageColor: r.primary_language_color,
        licenseName: r.license_name,
        licenseSpdx: r.license_spdx,
        topics: r.topics ?? [],
        commits: r.commits,
        pullRequests: r.prs,
        issues: r.issues,
        prReviews: r.pr_reviews,
        prComments: r.pr_comments,
        issueComments: r.issue_comments,
        contributors: r.contributors,
        contributorList: contributorsByRepoId.get(r.repo_id) ?? [],
        totalActivity:
          r.commits +
          r.prs +
          r.issues +
          r.pr_reviews +
          r.pr_comments +
          r.issue_comments,
      }))
      .filter((r) => r.totalActivity > 0)
      .sort((a, b) => b.totalActivity - a.totalActivity);
  }

  private buildUserRepos(
    userActivities: AggregatedActivityRow[],
    repoById: Map<string, AppRepositoryEntity>,
  ): UserRepoSummary[] {
    const out: UserRepoSummary[] = [];
    for (const activity of userActivities) {
      const repo = repoById.get(activity.repo_id);
      if (!repo) continue;
      out.push({
        repoName: repo.repoName,
        description: repo.description,
        url: repo.htmlUrl,
        primaryLanguage: repo.primaryLanguage,
        primaryLanguageColor: repo.primaryLanguageColor,
        stargazerCount: repo.stargazerCount,
        licenseName: repo.licenseName,
        licenseSpdx: repo.licenseSpdx,
        topics: repo.topics ?? [],
        commits: activity.commits,
        pullRequests: activity.prs,
        issues: activity.issues,
        prReviews: activity.pr_reviews,
        prComments: activity.pr_comments,
        issueComments: activity.issue_comments,
      });
    }
    return out;
  }

  private calculateUserSummary(repos: UserRepoSummary[]): UserSummaryTotals {
    return repos.reduce<UserSummaryTotals>(
      (totals, repo) => ({
        totalCommits: totals.totalCommits + repo.commits,
        totalPRs: totals.totalPRs + repo.pullRequests,
        totalIssues: totals.totalIssues + repo.issues,
        totalPRReviews: totals.totalPRReviews + repo.prReviews,
        totalPRComments: totals.totalPRComments + repo.prComments,
        totalIssueComments: totals.totalIssueComments + repo.issueComments,
      }),
      {
        totalCommits: 0,
        totalPRs: 0,
        totalIssues: 0,
        totalPRReviews: 0,
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
      (acc, activity) => ({
        totalCommits: acc.totalCommits + activity.commits,
        totalPRs: acc.totalPRs + activity.prs,
        totalIssues: acc.totalIssues + activity.issues,
        totalPRReviews: acc.totalPRReviews + activity.pr_reviews,
        totalPRComments: acc.totalPRComments + activity.pr_comments,
        totalIssueComments: acc.totalIssueComments + activity.issue_comments,
      }),
      {
        totalCommits: 0,
        totalPRs: 0,
        totalIssues: 0,
        totalPRReviews: 0,
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

}
