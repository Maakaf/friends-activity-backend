import { Injectable, Logger } from '@nestjs/common';
import type { UserActivityResponse } from './graphql-types.js';
import { USER_ACTIVITY_QUERY } from './graphql-queries.js';
import { GraphqlClient } from './graphql-client.js';
import { paginateIssueComments, fetchPRReviewsInWindow } from './pagination.js';
import { fetchRepoMetadata } from './metadata.js';
import {
  paginateReposContributedTo,
  fetchOverflowCounts,
  type ContributionType,
  type OverflowCounts,
  type RepoRef,
} from './overflow.js';
import { MIN_FORK_COUNT } from './constants.js';
import { aggregate } from './aggregate.js';
import {
  computeOssDailyContributions,
  walkOverflowCommits,
} from './daily-contributions.js';
import {
  upsertUserProfile,
  upsertRepositories,
  replaceUserActivity,
  replaceUserDailyContributions,
  markUserReady,
} from './persistence.js';
import type { RepoAggregate } from './aggregate.js';
import type { UserNode } from './graphql-types.js';

const DEFAULT_WINDOW_DAYS = 180;

export type FetchedUser =
  | {
      status: 'ready';
      login: string;
      user: UserNode;
      perRepo: Map<string, RepoAggregate>;
      dailyCounts: Map<string, number>;
      reposTouched: number;
      rateLimitCost: number;
      rateLimitRemaining: number;
      elapsedMs: number;
      commentPagesFetched: number;
      commentsInWindow: number;
    }
  | {
      status: 'failed' | 'not_found';
      login: string;
      error?: string;
      rateLimitCost: number;
      rateLimitRemaining: number;
      elapsedMs: number;
    };

@Injectable()
export class GraphqlIngestService {
  private readonly logger = new Logger(GraphqlIngestService.name);
  private readonly client: GraphqlClient;

  constructor() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }
    this.client = new GraphqlClient(token);
  }

  async fetchUser(
    login: string,
    windowDays = DEFAULT_WINDOW_DAYS,
  ): Promise<FetchedUser> {
    const start = Date.now();
    // Anchor the window to today's midnight UTC so boundaries don't slide
    // with the wall-clock time the refresh happens to run.
    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);
    const sinceMs = todayMidnight.getTime() - windowDays * 86_400_000;
    const since = new Date(sinceMs).toISOString();

    try {
      this.logger.log(`🔄 Fetching ${login} (window=${windowDays}d)`);

      const mainP = this.client.call<UserActivityResponse>(USER_ACTIVITY_QUERY, { login, since });
      const reviewsP = fetchPRReviewsInWindow(this.client, login, since);
      // Mark reviewsP as handled so an early return/throw in this function
      // doesn't leave it dangling and crash the process via unhandled rejection.
      // The real handler is the await inside Promise.all below.
      reviewsP.catch(() => {});

      const primary = await mainP;
      if (!primary.user) {
        this.logger.warn(`⚠️ User '${login}' not found on GitHub`);
        return {
          status: 'not_found',
          login,
          rateLimitCost: primary.rateLimit?.cost ?? 0,
          rateLimitRemaining: primary.rateLimit?.remaining ?? -1,
          elapsedMs: Date.now() - start,
        };
      }
      const user = primary.user;
      const contributions = user.contributionsCollection;

      const initialIds = new Set<string>();
      const knownIdsByType: Record<ContributionType, Set<string>> = {
        COMMIT: new Set(),
        PULL_REQUEST: new Set(),
        ISSUE: new Set(),
        PULL_REQUEST_REVIEW: new Set(),
      };
      for (const bucket of contributions.commitContributionsByRepository) {
        initialIds.add(bucket.repository.id);
        knownIdsByType.COMMIT.add(bucket.repository.id);
      }
      for (const bucket of contributions.pullRequestContributionsByRepository) {
        initialIds.add(bucket.repository.id);
        knownIdsByType.PULL_REQUEST.add(bucket.repository.id);
      }
      for (const bucket of contributions.issueContributionsByRepository) {
        initialIds.add(bucket.repository.id);
        knownIdsByType.ISSUE.add(bucket.repository.id);
      }
      for (const bucket of contributions.pullRequestReviewContributionsByRepository) {
        initialIds.add(bucket.repository.id);
        knownIdsByType.PULL_REQUEST_REVIEW.add(bucket.repository.id);
      }
      for (const comment of user.issueComments.nodes) {
        if (comment.repository?.id) initialIds.add(comment.repository.id);
      }

      const overflowTypes: ContributionType[] = [];
      if (contributions.totalRepositoriesWithContributedCommits > knownIdsByType.COMMIT.size)
        overflowTypes.push('COMMIT');
      if (contributions.totalRepositoriesWithContributedPullRequests > knownIdsByType.PULL_REQUEST.size)
        overflowTypes.push('PULL_REQUEST');
      if (contributions.totalRepositoriesWithContributedIssues > knownIdsByType.ISSUE.size)
        overflowTypes.push('ISSUE');
      if (contributions.totalRepositoriesWithContributedPullRequestReviews > knownIdsByType.PULL_REQUEST_REVIEW.size)
        overflowTypes.push('PULL_REQUEST_REVIEW');

      const overflowReposByType: Record<ContributionType, RepoRef[]> = {
        COMMIT: [],
        PULL_REQUEST: [],
        ISSUE: [],
        PULL_REQUEST_REVIEW: [],
      };
      const overflowRepoIds = new Set<string>();
      if (overflowTypes.length > 0) {
        this.logger.warn(
          `↗️ ${login} has bucket overflow on ${overflowTypes.join(', ')} — paginating beyond 100`,
        );
        const lists = await Promise.all(
          overflowTypes.map((t) => paginateReposContributedTo(this.client, login, t)),
        );
        overflowTypes.forEach((t, i) => {
          for (const r of lists[i]) {
            if (!knownIdsByType[t].has(r.id) && r.forkCount >= MIN_FORK_COUNT) {
              overflowReposByType[t].push(r);
              overflowRepoIds.add(r.id);
            }
          }
        });
      }

      const [commentResult, reviewsResult, metadata] = await Promise.all([
        paginateIssueComments(this.client, login, user, sinceMs),
        reviewsP,
        fetchRepoMetadata(this.client, [...initialIds, ...overflowRepoIds]),
      ]);

      const overflowCommitWalk =
        overflowReposByType.COMMIT.length > 0
          ? await walkOverflowCommits(this.client, user.id, since, overflowReposByType.COMMIT)
          : { events: [], totalsByRepo: new Map<string, number>() };

      const overflowCounts =
        overflowRepoIds.size > 0
          ? await fetchOverflowCounts(this.client, login, user.id, since, overflowReposByType, overflowCommitWalk.totalsByRepo)
          : new Map<string, OverflowCounts>();

      const { nodes: commentNodes, pagesFetched } = commentResult;
      const commentsInWindow = commentNodes.filter(
        (cm) => new Date(cm.createdAt).getTime() >= sinceMs,
      );

      const allKnownIds = new Set<string>([...initialIds, ...overflowRepoIds]);
      const extraIds: string[] = [];
      for (const cm of commentsInWindow) {
        const id = cm.repository?.id;
        if (id && !allKnownIds.has(id)) { allKnownIds.add(id); extraIds.push(id); }
      }
      for (const r of reviewsResult.reviewsInWindow) {
        const id = r.repository?.id;
        if (id && !allKnownIds.has(id)) { allKnownIds.add(id); extraIds.push(id); }
      }
      if (extraIds.length > 0) {
        const extra = await fetchRepoMetadata(this.client, extraIds);
        for (const [k, v] of extra) metadata.set(k, v);
      }

      const perRepo = aggregate(user, commentsInWindow, reviewsResult.reviewsInWindow, metadata, overflowCounts);

      const dailyCounts = await computeOssDailyContributions({
        client: this.client,
        login,
        sinceISO: since,
        user,
        overflowCommitEvents: overflowCommitWalk.events,
        reviewsInWindow: reviewsResult.reviewsInWindow,
        commentsInWindow,
        metadata,
      });

      this.logger.log(
        `✅ ${login} fetched in ${Date.now() - start}ms — ` +
          `${perRepo.size} repos, ${commentsInWindow.length} issue/PR comments ` +
          `(${pagesFetched} pg), ${reviewsResult.reviewsInWindow.length} reviews ` +
          `(${reviewsResult.pagesFetched} pg)`,
      );

      return {
        status: 'ready',
        login,
        user,
        perRepo,
        dailyCounts,
        reposTouched: perRepo.size,
        rateLimitCost: primary.rateLimit?.cost ?? 0,
        rateLimitRemaining: primary.rateLimit?.remaining ?? -1,
        elapsedMs: Date.now() - start,
        commentPagesFetched: pagesFetched,
        commentsInWindow: commentsInWindow.length,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Failed to fetch ${login}: ${msg}`);
      return {
        status: 'failed',
        login,
        error: msg,
        rateLimitCost: 0,
        rateLimitRemaining: -1,
        elapsedMs: Date.now() - start,
      };
    }
  }

}
