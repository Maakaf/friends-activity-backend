import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { paginateRest } from '@octokit/plugin-paginate-rest';

const MyOctokit = Octokit.plugin(paginateRest);

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

@Injectable()
export class GithubClientService {
  private readonly logger = new Logger(GithubClientService.name);
  private readonly octokit: InstanceType<typeof MyOctokit>;

  constructor() {
    this.octokit = new MyOctokit({
      auth: process.env.GITHUB_TOKEN || (() => { throw new Error('GITHUB_TOKEN required'); })(),
      userAgent: 'friends-activity-backend/1.0',
    });
  }

  // ---------- Repo operations ----------

  async reposGet(owner: string, repo: string) {
    return this.retry(async () => {
      const { data } = await this.octokit.repos.get({ owner, repo });
      return data;
    }, `repos.get(${owner}/${repo})`);
  }

  async listRepos(org: string) {
    return this.retry(async () => {
      return this.octokit.paginate(
        this.octokit.repos.listForOrg,
        { org, type: 'all', per_page: 100 },
        (r) => r.data,
      );
    }, `listRepos(${org})`);
  }

  async listCommits(owner: string, repo: string, params: any) {
    return this.retry(async () => {
      return this.octokit.paginate(
        this.octokit.repos.listCommits,
        { owner, repo, per_page: 100, ...params },
        (r) => r.data,
      );
    }, `listCommits(${owner}/${repo})`);
  }

  // ---------- Issues & PRs ----------

  async searchIssuesAndPRs(q: string) {
    return this.retry(async () => {
      return this.octokit.paginate(
        this.octokit.search.issuesAndPullRequests,
        { q, per_page: 100 },
        (r) => r.data,
      );
    }, `searchIssues(${q})`);
  }

  async listIssuesForRepo(params: any) {
    return this.retry(async () => {
      return this.octokit.paginate(
        this.octokit.issues.listForRepo,
        { per_page: 100, ...params },
        (r) => r.data,
      );
    }, `issues.listForRepo(${params.owner}/${params.repo})`);
  }

  async getIssue(params: any) {
    return this.retry(async () => {
      const { data } = await this.octokit.issues.get(params);
      return data;
    }, `issues.get(${params.owner}/${params.repo}#${params.issue_number})`);
  }

  async listCommentsForRepo(params: any) {
    return this.retry(async () => {
      return this.octokit.paginate(
        this.octokit.issues.listCommentsForRepo,
        { per_page: 100, ...params },
        (r) => r.data,
      );
    }, `issues.listCommentsForRepo(${params.owner}/${params.repo})`);
  }

  async listReviewCommentsForRepo(params: any) {
    return this.retry(async () => {
      return this.octokit.paginate(
        this.octokit.pulls.listReviewCommentsForRepo,
        { per_page: 100, ...params },
        (r) => r.data,
      );
    }, `pulls.listReviewCommentsForRepo(${params.owner}/${params.repo})`);
  }

  async getPull(params: any) {
    return this.retry(async () => {
      const { data } = await this.octokit.pulls.get(params);
      return data;
    }, `pulls.get(${params.owner}/${params.repo}#${params.pull_number})`);
  }

  // ---------- Commits search ----------

  async searchCommits(q: string) {
    return this.retry(async () => {
      return this.octokit.paginate(
        this.octokit.search.commits,
        { q, per_page: 100, headers: { accept: 'application/vnd.github.cloak-preview+json' } },
        (r) => r.data,
      );
    }, `searchCommits(${q})`);
  }

  // ---------- Retry helper ----------

  private async retry<T>(fn: () => Promise<T>, label: string, maxAttempts = 5): Promise<T> {
    let attempt = 0;
    let delayMs = 1000;

    while (true) {
      attempt++;
      try {
        return await fn();
      } catch (err: any) {
        const status = err?.status;
        const message = err?.message || 'unknown error';

        if (attempt >= maxAttempts) throw err;

        // Rate-limit headers
        const reset = Number(err?.response?.headers?.['x-ratelimit-reset']);
        const retryAfter = Number(err?.response?.headers?.['retry-after']);

        if (retryAfter) {
          delayMs = retryAfter * 1000;
        } else if (!Number.isNaN(reset)) {
          const nowSec = Math.floor(Date.now() / 1000);
          delayMs = Math.max(0, (reset - nowSec) * 1000);
        } else {
          delayMs = Math.min(delayMs * 2, 60_000); // exponential backoff up to 60s
        }

        this.logger.warn(
          `[${label}] attempt ${attempt} failed (status=${status}, msg=${message}), retrying in ${delayMs}ms`,
        );
        await sleep(delayMs);
      }
    }
  }
}
