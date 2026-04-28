import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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
import { aggregate } from './aggregate.js';
import {
  upsertUserProfile,
  upsertRepositories,
  replaceUserActivity,
  markUserReady,
  markUserFailed,
} from './persistence.js';

const DEFAULT_WINDOW_DAYS = 180;
const DEFAULT_CONCURRENCY = 30;

export interface IngestUserResult {
  login: string;
  status: 'ready' | 'failed' | 'not_found';
  reposTouched: number;
  rateLimitCost: number;
  rateLimitRemaining: number;
  elapsedMs: number;
  commentPagesFetched: number;
  commentsInWindow: number;
  error?: string;
}

@Injectable()
export class GraphqlIngestService {
  private readonly logger = new Logger(GraphqlIngestService.name);
  private readonly client: GraphqlClient;

  constructor(@InjectDataSource() private readonly ds: DataSource) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }
    this.client = new GraphqlClient(token);
  }

  async ingestUsers(
    logins: string[],
    windowDays = DEFAULT_WINDOW_DAYS,
    concurrency = DEFAULT_CONCURRENCY,
  ): Promise<IngestUserResult[]> {
    const results: IngestUserResult[] = new Array<IngestUserResult>(
      logins.length,
    );
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (true) {
        const i = cursor++;
        if (i >= logins.length) return;
        results[i] = await this.ingestUser(logins[i], windowDays);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(concurrency, logins.length) }, () =>
        worker(),
      ),
    );
    return results;
  }

  async ingestUser(
    login: string,
    windowDays = DEFAULT_WINDOW_DAYS,
  ): Promise<IngestUserResult> {
    const start = Date.now();
    const sinceMs = Date.now() - windowDays * 86_400_000;
    const since = new Date(sinceMs).toISOString();

    try {
      this.logger.log(`🔄 Ingesting ${login} (window=${windowDays}d)`);

      const mainP = this.client.call<UserActivityResponse>(
        USER_ACTIVITY_QUERY,
        {
          login,
          since,
        },
      );
      const reviewsP = fetchPRReviewsInWindow(this.client, login, since);

      const primary = await mainP;
      if (!primary.user) {
        this.logger.warn(`⚠️ User '${login}' not found on GitHub`);
        return {
          login,
          status: 'not_found',
          reposTouched: 0,
          rateLimitCost: primary.rateLimit?.cost ?? 0,
          rateLimitRemaining: primary.rateLimit?.remaining ?? -1,
          elapsedMs: Date.now() - start,
          commentPagesFetched: 1,
          commentsInWindow: 0,
        };
      }
      const user = primary.user;
      const c = user.contributionsCollection;

      const initialIds = new Set<string>();
      const knownIdsByType: Record<ContributionType, Set<string>> = {
        COMMIT: new Set(),
        PULL_REQUEST: new Set(),
        ISSUE: new Set(),
        PULL_REQUEST_REVIEW: new Set(),
      };
      for (const e of c.commitContributionsByRepository) {
        initialIds.add(e.repository.id);
        knownIdsByType.COMMIT.add(e.repository.id);
      }
      for (const e of c.pullRequestContributionsByRepository) {
        initialIds.add(e.repository.id);
        knownIdsByType.PULL_REQUEST.add(e.repository.id);
      }
      for (const e of c.issueContributionsByRepository) {
        initialIds.add(e.repository.id);
        knownIdsByType.ISSUE.add(e.repository.id);
      }
      for (const e of c.pullRequestReviewContributionsByRepository) {
        initialIds.add(e.repository.id);
        knownIdsByType.PULL_REQUEST_REVIEW.add(e.repository.id);
      }
      for (const cm of user.issueComments.nodes) {
        if (cm.repository?.id) initialIds.add(cm.repository.id);
      }

      const overflowTypes: ContributionType[] = [];
      if (
        c.totalRepositoriesWithContributedCommits > knownIdsByType.COMMIT.size
      )
        overflowTypes.push('COMMIT');
      if (
        c.totalRepositoriesWithContributedPullRequests >
        knownIdsByType.PULL_REQUEST.size
      )
        overflowTypes.push('PULL_REQUEST');
      if (c.totalRepositoriesWithContributedIssues > knownIdsByType.ISSUE.size)
        overflowTypes.push('ISSUE');
      if (
        c.totalRepositoriesWithContributedPullRequestReviews >
        knownIdsByType.PULL_REQUEST_REVIEW.size
      )
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
          overflowTypes.map((t) =>
            paginateReposContributedTo(this.client, login, t),
          ),
        );
        overflowTypes.forEach((t, i) => {
          for (const r of lists[i]) {
            if (!knownIdsByType[t].has(r.id)) {
              overflowReposByType[t].push(r);
              overflowRepoIds.add(r.id);
            }
          }
        });
      }

      const metadataP = fetchRepoMetadata(this.client, [
        ...initialIds,
        ...overflowRepoIds,
      ]);
      const commentsP = paginateIssueComments(
        this.client,
        login,
        user,
        sinceMs,
      );
      const overflowCountsP =
        overflowRepoIds.size > 0
          ? fetchOverflowCounts(
              this.client,
              login,
              user.id,
              since,
              overflowReposByType,
            )
          : Promise.resolve(new Map<string, OverflowCounts>());

      const [commentResult, reviewsResult, metadata, overflowCounts] =
        await Promise.all([commentsP, reviewsP, metadataP, overflowCountsP]);
      const { nodes: commentNodes, pagesFetched } = commentResult;

      const commentsInWindow = commentNodes.filter(
        (cm) => new Date(cm.createdAt).getTime() >= sinceMs,
      );

      const allKnownIds = new Set<string>([...initialIds, ...overflowRepoIds]);
      const extraIds: string[] = [];
      for (const cm of commentsInWindow) {
        const id = cm.repository?.id;
        if (id && !allKnownIds.has(id)) {
          allKnownIds.add(id);
          extraIds.push(id);
        }
      }
      for (const r of reviewsResult.reviewsInWindow) {
        const id = r.repository?.id;
        if (id && !allKnownIds.has(id)) {
          allKnownIds.add(id);
          extraIds.push(id);
        }
      }
      if (extraIds.length > 0) {
        const extra = await fetchRepoMetadata(this.client, extraIds);
        for (const [k, v] of extra) metadata.set(k, v);
      }

      const perRepo = aggregate(
        user,
        commentsInWindow,
        reviewsResult.reviewsInWindow,
        metadata,
        overflowCounts,
      );

      await this.ds.transaction(async (tx) => {
        await upsertUserProfile(tx, user);
        await upsertRepositories(tx, perRepo);
        await replaceUserActivity(tx, user, perRepo);
        await markUserReady(tx, user);
      });

      this.logger.log(
        `✅ ${login} ingested in ${Date.now() - start}ms — ` +
          `${perRepo.size} repos, ${commentsInWindow.length} issue/PR comments ` +
          `(${pagesFetched} pg), ` +
          `${reviewsResult.reviewsInWindow.length} reviews ` +
          `(${reviewsResult.pagesFetched} pg)`,
      );

      return {
        login,
        status: 'ready',
        reposTouched: perRepo.size,
        rateLimitCost: primary.rateLimit?.cost ?? 0,
        rateLimitRemaining: primary.rateLimit?.remaining ?? -1,
        elapsedMs: Date.now() - start,
        commentPagesFetched: pagesFetched,
        commentsInWindow: commentsInWindow.length,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Failed to ingest ${login}: ${msg}`);
      await markUserFailed(this.ds, login, msg).catch(() => {});
      return {
        login,
        status: 'failed',
        reposTouched: 0,
        rateLimitCost: 0,
        rateLimitRemaining: -1,
        elapsedMs: Date.now() - start,
        commentPagesFetched: 0,
        commentsInWindow: 0,
        error: msg,
      };
    }
  }
}
