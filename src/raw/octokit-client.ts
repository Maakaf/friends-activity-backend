import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
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

const MyOctokit = Octokit.plugin(paginateRest);

@Injectable()
export class OctokitClient implements GithubClient {
    // TODO: is this needed ?
    private readonly logger = new Logger(OctokitClient.name);
    private readonly octokit = new MyOctokit({
        auth: process.env.GITHUB_TOKEN || (() => { throw new Error('GITHUB_TOKEN environment variable is required'); })(),
        userAgent: 'friends-activity-backend/1.0',
        request: { headers: { accept: 'application/vnd.github+json' } },
    });

    // Users
    async getUserByUsername(params: { username: string; }): Promise<GithubUserDTO> {
        throw new Error('Not implemented');
    }

    // Repos
    async getRepo(params: { owner: string; repo: string; }): Promise<GithubRepoMetaDTO> {
        throw new Error('Not implemented');
    }

    async listRepoCommits(params: { owner: string; repo: string; sinceIso: string; untilIso?: string; authorLogin?: string; }): Promise<GithubCommitDTO[]> {
        throw new Error('Not implemented');
    }

    // Issues and PRs
    async listIssuesAndPullsForRepo(params: { owner: string; repo: string; sinceIso: string; creatorLogin?: string; }): Promise<GithubIssueOrPRDTO[]> {
        throw new Error('Not implemented');
    }

    async getIssue(params: { owner: string; repo: string; issueNumber: number; }): Promise<GithubIssueDTO> {
        throw new Error('Not implemented');
    }

    async getPull(params: { owner: string; repo: string; pullNumber: number; }): Promise<GithubPullRequestDTO> {
        throw new Error('Not implemented');
    }

    // Comments
    async listIssueCommentsForRepo(params: { owner: string; repo: string; sinceIso: string; }): Promise<GithubIssueCommentDTO[]> {
        throw new Error('Not implemented');
    }

    async listReviewCommentsForRepo(params: { owner: string; repo: string; sinceIso: string; }): Promise<GithubPRReviewCommentDTO[]> {
        throw new Error('Not implemented');
    }

    // Pull Request commits
    async listCommitsForPull(params: { owner: string; repo: string; pullNumber: number; }): Promise<GithubCommitDTO[]> {
        throw new Error('Not implemented');
    }

    // Search
    async searchIssuesAndPulls(params: { q: string; }): Promise<GithubSearchIssueOrPRDTO[]> {
        throw new Error('Not implemented');
    }

    async searchCommits(params: { q: string; }): Promise<GithubSearchCommitDTO[]> {
        throw new Error('Not implemented');
    }
}


