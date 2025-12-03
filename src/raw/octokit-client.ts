import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import type { RestEndpointMethodTypes } from '@octokit/rest';
import type { RequestParameters } from '@octokit/types';
import { paginateRest } from '@octokit/plugin-paginate-rest';

import type {
  GithubClient,
  GithubUserDTO,
  GithubRepoMetaDTO,
  GithubIssueOrPRDTO,
  GithubIssueDTO,
  GithubPullRequestDTO,
  GithubIssueCommentDTO,
  GithubPRReviewCommentDTO,
  GithubCommitDTO,
  GithubSearchIssueOrPRDTO,
  GithubSearchCommitDTO,
} from './github-client-interface.js';

// ---------- PARAM TYPES ----------
type RepoCommitParams =
  RestEndpointMethodTypes['repos']['listCommits']['parameters'];

type IssueOrPRParams =
  RestEndpointMethodTypes['issues']['listForRepo']['parameters'];

type IssueCommentParams =
  RestEndpointMethodTypes['issues']['listCommentsForRepo']['parameters'];

type ReviewCommentParams =
  RestEndpointMethodTypes['pulls']['listReviewCommentsForRepo']['parameters'];

type PullCommitParams =
  RestEndpointMethodTypes['pulls']['listCommits']['parameters'];

type SearchCommitParams =
  RestEndpointMethodTypes['search']['commits']['parameters'];

type SearchCommitItem =
  RestEndpointMethodTypes['search']['commits']['response']['data']['items'][number];

const MyOctokit = Octokit.plugin(paginateRest);

@Injectable()
export class OctokitClient implements GithubClient {
  private readonly logger = new Logger(OctokitClient.name);

  private readonly octokit = new MyOctokit({
    auth:
      process.env.GITHUB_TOKEN ||
      (() => {
        throw new Error('GITHUB_TOKEN environment variable is required');
      })(),
    userAgent: 'friends-activity-backend/1.0',
    request: { headers: { accept: 'application/vnd.github+json' } },
  });

  // ---------- USERS ----------
  async getUserByUsername(params: {
    username: string;
  }): Promise<GithubUserDTO> {
    const { data } = await this.octokit.users.getByUsername({
      username: params.username,
    });

    return {
      id: String(data.id),
      login: data.login,
      raw: data,
    };
  }

  // ---------- REPOS ----------
  async getRepo(params: {
    owner: string;
    repo: string;
  }): Promise<GithubRepoMetaDTO> {
    const { data } = await this.octokit.repos.get({
      owner: params.owner,
      repo: params.repo,
    });

    return {
      id: Number(data.id),
      fullName: data.full_name,
      ownerLogin: data.owner?.login ?? '',
      name: data.name ?? params.repo,
      private: Boolean(data.private),
      raw: data,
    };
  }

  async listRepoCommits(params: {
    owner: string;
    repo: string;
    sinceIso: string;
    untilIso?: string;
    authorLogin?: string;
  }): Promise<GithubCommitDTO[]> {
    const payload: RepoCommitParams = {
      owner: params.owner,
      repo: params.repo,
      per_page: 100,
      since: params.sinceIso,
    };

    if (params.untilIso) payload.until = params.untilIso;
    if (params.authorLogin) payload.author = params.authorLogin;

    const items = await this.octokit.paginate(
      this.octokit.repos.listCommits,
      payload,
      (r) => r.data,
    );

    return items.map((c) => ({
      sha: String(c.sha),
      authorLogin: c.author?.login ?? null,
      authorId: c.author?.id != null ? String(c.author.id) : null,
      committedDate: c.commit?.committer?.date ?? null,
      raw: c,
    }));
  }

  // ---------- ISSUES & PRs ----------
  async listIssuesAndPullsForRepo(params: {
    owner: string;
    repo: string;
    sinceIso: string;
    creatorLogin?: string;
  }): Promise<GithubIssueOrPRDTO[]> {
    const payload: IssueOrPRParams = {
      owner: params.owner,
      repo: params.repo,
      state: 'all',
      per_page: 100,
      since: params.sinceIso,
    };

    if (params.creatorLogin) payload.creator = params.creatorLogin;

    const items = await this.octokit.paginate(
      this.octokit.issues.listForRepo,
      payload,
      (r) => r.data,
    );

    return items.map((it) => ({
      id: String(it.id),
      number: Number(it.number),
      isPR: it.pull_request != null,
      userId: it.user?.id != null ? String(it.user.id) : null,
      createdAt: it.created_at ?? null,
      repoOwner: params.owner,
      repoName: params.repo,
      raw: it,
    }));
  }

  async getIssue(params: {
    owner: string;
    repo: string;
    issueNumber: number;
  }): Promise<GithubIssueDTO> {
    const { data } = await this.octokit.issues.get({
      owner: params.owner,
      repo: params.repo,
      issue_number: params.issueNumber,
    });

    return { id: String(data.id), raw: data };
  }

  async getPull(params: {
    owner: string;
    repo: string;
    pullNumber: number;
  }): Promise<GithubPullRequestDTO> {
    const { data } = await this.octokit.pulls.get({
      owner: params.owner,
      repo: params.repo,
      pull_number: params.pullNumber,
    });

    return { id: String(data.id), raw: data };
  }

  // ---------- ISSUE COMMENTS ----------
  async listIssueCommentsForRepo(params: {
    owner: string;
    repo: string;
    sinceIso: string;
  }): Promise<GithubIssueCommentDTO[]> {
    const items = await this.octokit.paginate(
      this.octokit.issues.listCommentsForRepo,
      {
        owner: params.owner,
        repo: params.repo,
        per_page: 100,
        since: params.sinceIso,
      } satisfies IssueCommentParams,
      (r) => r.data,
    );

    return items.map((c) => ({
      id: String(c.id),
      userLogin: c.user?.login ?? null,
      userId: c.user?.id != null ? String(c.user.id) : null,
      createdAt: c.created_at ?? null,
      issueUrl: c.issue_url ?? null,
      raw: c,
    }));
  }

  // ---------- PR REVIEW COMMENTS ----------
  async listReviewCommentsForRepo(params: {
    owner: string;
    repo: string;
    sinceIso: string;
  }): Promise<GithubPRReviewCommentDTO[]> {
    const items = await this.octokit.paginate(
      this.octokit.pulls.listReviewCommentsForRepo,
      {
        owner: params.owner,
        repo: params.repo,
        per_page: 100,
        since: params.sinceIso,
      } satisfies ReviewCommentParams,
      (r) => r.data,
    );

    return items.map((c) => ({
      id: String(c.id),
      userLogin: c.user?.login ?? null,
      userId: c.user?.id != null ? String(c.user.id) : null,
      createdAt: c.created_at ?? null,
      pullRequestUrl: c.pull_request_url ?? null,
      raw: c,
    }));
  }

  // ---------- PR COMMITS ----------
  async listCommitsForPull(params: {
    owner: string;
    repo: string;
    pullNumber: number;
  }): Promise<GithubCommitDTO[]> {
    const items = await this.octokit.paginate(
      this.octokit.pulls.listCommits,
      {
        owner: params.owner,
        repo: params.repo,
        pull_number: params.pullNumber,
        per_page: 100,
      } satisfies PullCommitParams,
      (r) => r.data,
    );

    return items.map((c) => ({
      sha: String(c.sha),
      authorLogin: c.author?.login ?? null,
      authorId: c.author?.id != null ? String(c.author.id) : null,
      committedDate: c.commit?.committer?.date ?? null,
      raw: c,
    }));
  }

  // ---------- SEARCH: ISSUES / PRs ----------
  async searchIssuesAndPulls(params: {
    q: string;
  }): Promise<GithubSearchIssueOrPRDTO[]> {
    type MinimalSearchIssueOrPR = {
      repository_url?: string | null;
      [key: string]: unknown;
    };

    type SearchIssuesResponse = {
      items: MinimalSearchIssueOrPR[];
    };

    const response = await this.octokit.request('GET /search/issues', {
      q: params.q,
      per_page: 100,
    });

    const data = response.data as SearchIssuesResponse;
    const items: MinimalSearchIssueOrPR[] = Array.isArray(data.items)
      ? data.items
      : [];

    return items.map(
      (it): GithubSearchIssueOrPRDTO => ({
        repositoryUrl:
          typeof it.repository_url === 'string' ? it.repository_url : null,
        raw: it,
      }),
    );
  }

  // ---------- SEARCH: COMMITS ----------
  async searchCommits(params: { q: string }): Promise<GithubSearchCommitDTO[]> {
    const { data } = await this.octokit.search.commits({
      q: params.q,
      per_page: 100,
      request: {
        headers: {
          accept: 'application/vnd.github.cloak-preview+json',
        },
      },
    } as SearchCommitParams & RequestParameters);

    const items: SearchCommitItem[] = Array.isArray(data.items)
      ? data.items
      : [];

    return items.map(
      (it): GithubSearchCommitDTO => ({
        repositoryFullName: it.repository?.full_name ?? null,
        htmlUrl: it.html_url ?? null,
        raw: it,
      }),
    );
  }
}
