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
        const { data } = await this.octokit.users.getByUsername({ username: params.username });
        return {
            id: String((data as any).id),
            login: (data as any).login,
            raw: data,
        };
    }

    // Repos
    async getRepo(params: { owner: string; repo: string; }): Promise<GithubRepoMetaDTO> {
        const { data } = await this.octokit.repos.get({ owner: params.owner, repo: params.repo });
        return {
            id: Number((data as any).id),
            fullName: (data as any).full_name,
            ownerLogin: (data as any).owner?.login,
            name: (data as any).name,
            private: Boolean((data as any).private),
            raw: data,
        };
    }

    async listRepoCommits(params: { owner: string; repo: string; sinceIso: string; untilIso?: string; authorLogin?: string; }): Promise<GithubCommitDTO[]> {
        const listParams: any = { owner: params.owner, repo: params.repo, per_page: 100, since: params.sinceIso };
        if (params.untilIso) listParams.until = params.untilIso;
        if (params.authorLogin) listParams.author = params.authorLogin;
        const items = await this.octokit.paginate(
            this.octokit.repos.listCommits,
            listParams,
            (r) => r.data,
        );
        return items.map((c: any): GithubCommitDTO => ({
            sha: String(c.sha),
            authorLogin: c.author?.login ?? null,
            authorId: c.author?.id != null ? String(c.author.id) : null,
            committedDate: c.commit?.committer?.date ?? null,
            raw: c,
        }));
    }

    // Issues and PRs
    async listIssuesAndPullsForRepo(params: { owner: string; repo: string; sinceIso: string; creatorLogin?: string; }): Promise<GithubIssueOrPRDTO[]> {
        const listParams: any = { owner: params.owner, repo: params.repo, state: 'all', per_page: 100, since: params.sinceIso };
        if (params.creatorLogin) listParams.creator = params.creatorLogin;
        const items = await this.octokit.paginate(
            this.octokit.issues.listForRepo,
            listParams,
            (r) => r.data,
        );
        return items.map((it: any): GithubIssueOrPRDTO => ({
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

    async getIssue(params: { owner: string; repo: string; issueNumber: number; }): Promise<GithubIssueDTO> {
        const { owner, repo, issueNumber } = params;
        const { data } = await this.octokit.issues.get({ owner, repo, issue_number: issueNumber });
        return { id: String((data as any).id), raw: data };
    }

    async getPull(params: { owner: string; repo: string; pullNumber: number; }): Promise<GithubPullRequestDTO> {
        const { owner, repo, pullNumber } = params;
        const { data } = await this.octokit.pulls.get({ owner, repo, pull_number: pullNumber });
        return { id: String((data as any).id), raw: data };
    }

    // Comments
    async listIssueCommentsForRepo(params: { owner: string; repo: string; sinceIso: string; }): Promise<GithubIssueCommentDTO[]> {
        const items = await this.octokit.paginate(
            this.octokit.issues.listCommentsForRepo,
            { owner: params.owner, repo: params.repo, per_page: 100, since: params.sinceIso },
            (r) => r.data,
        );
        return items.map((c: any): GithubIssueCommentDTO => ({
            id: String(c.id),
            userLogin: c.user?.login ?? null,
            userId: c.user?.id != null ? String(c.user.id) : null,
            createdAt: c.created_at ?? null,
            issueUrl: c.issue_url ?? null,
            raw: c,
        }));
    }

    async listReviewCommentsForRepo(params: { owner: string; repo: string; sinceIso: string; }): Promise<GithubPRReviewCommentDTO[]> {
        const items = await this.octokit.paginate(
            this.octokit.pulls.listReviewCommentsForRepo,
            { owner: params.owner, repo: params.repo, per_page: 100, since: params.sinceIso },
            (r) => r.data,
        );
        return items.map((c: any): GithubPRReviewCommentDTO => ({
            id: String(c.id),
            userLogin: c.user?.login ?? null,
            userId: c.user?.id != null ? String(c.user.id) : null,
            createdAt: c.created_at ?? null,
            pullRequestUrl: c.pull_request_url ?? null,
            raw: c,
        }));
    }

    // Pull Request commits
    async listCommitsForPull(params: { owner: string; repo: string; pullNumber: number; }): Promise<GithubCommitDTO[]> {
        const items = await this.octokit.paginate(
            this.octokit.pulls.listCommits,
            { owner: params.owner, repo: params.repo, pull_number: params.pullNumber, per_page: 100 },
            (r) => r.data,
        );
        return items.map((c: any): GithubCommitDTO => ({
            sha: String(c.sha),
            authorLogin: c.author?.login ?? null,
            authorId: c.author?.id != null ? String(c.author.id) : null,
            committedDate: c.commit?.committer?.date ?? null,
            raw: c,
        }));
    }

    // Search
    async searchIssuesAndPulls(params: { q: string; }): Promise<GithubSearchIssueOrPRDTO[]> {
        const items = await this.octokit.paginate(
            this.octokit.search.issuesAndPullRequests,
            { q: params.q, per_page: 100, advanced_search: 'true' as any },
        );
        return (items as any[]).map((it: any): GithubSearchIssueOrPRDTO => ({
            repositoryUrl: it.repository_url ?? null,
            raw: it,
        }));
    }

    async searchCommits(params: { q: string; }): Promise<GithubSearchCommitDTO[]> {
        const items = await this.octokit.paginate(
            this.octokit.search.commits,
            {
                q: params.q,
                per_page: 100,
                headers: { accept: 'application/vnd.github.cloak-preview+json' },
            } as any,
        );
        return (items as any[]).map((it: any): GithubSearchCommitDTO => ({
            repositoryFullName: it.repository?.full_name ?? null,
            htmlUrl: it.html_url ?? null,
            raw: it,
        }));
    }
}


