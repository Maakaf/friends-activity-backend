import { Injectable, Inject } from '@nestjs/common';
import type { SilverBundle } from './types.js';
import { UsersSilverService } from './user/user.service.js';
import { ReposSilverService } from './repo/repo.service.js';
import { IssueSilverService } from './issue/issue.service.js';
import { PRSilverService } from './pr/pr.service.js';
import { CommentSilverService } from './comment/comment.service.js';
import { CommitSilverService } from './commit/commit.service.js';

export interface SilverBuildArgs {
  sinceIso?: string;
  untilIso?: string;      //optional
  limit?: number;        // optional
}

@Injectable()
export class SilverOrchestratorService {
  constructor(
    @Inject(UsersSilverService) private readonly usersSvc: UsersSilverService,
    @Inject(ReposSilverService) private readonly reposSvc: ReposSilverService,
    @Inject(IssueSilverService) private readonly issuesSvc: IssueSilverService,
    @Inject(PRSilverService) private readonly prsSvc: PRSilverService,
    @Inject(CommentSilverService) private readonly commentsSvc: CommentSilverService,
    @Inject(CommitSilverService) private readonly commitsSvc: CommitSilverService,
  ) {}

  async buildBundle(args: SilverBuildArgs = {}): Promise<SilverBundle> {
    const sinceIso = args.sinceIso ?? new Date(Date.now() - 180 * 86400e3)
      .toISOString().replace(/\.\d{3}Z$/, 'Z');
    const untilIso = args.untilIso;

    const [users, repos, issues, prs, comments, commits] = await Promise.all([
      this.usersSvc.getUsersSince({ sinceIso, untilIso, limit: args.limit }),
      this.reposSvc.getReposSince({ sinceIso, untilIso, limit: args.limit }),
      this.issuesSvc.getIssuesSince({ sinceIso, untilIso }),
      this.prsSvc.getPRsSince({ sinceIso, untilIso }),
      this.commentsSvc.getCommentsSince({ sinceIso, untilIso }),
      this.commitsSvc.getCommitsSince({ sinceIso, untilIso }),
    ]);

    return { users, repos, issues, prs, comments, commits };
  }
}
