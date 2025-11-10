import { Module, Provider } from '@nestjs/common';
import { GithubModule } from '../raw/raw.module.js';

// Bronze repo tokens
import { IssueBronzeRepo } from './issue/issue.repo.js';
import { PRBronzeRepo } from './pr/pr.repo.js';
import { CommentBronzeRepo } from './comment/comment.repo.js';
import { CommitBronzeRepo } from './commit/commit.repo.js';
import { UserBronzeRepo } from './user/user.repo.js';
import { RepoBronzeRepo } from './repo/repo.repo.js';

// Memory implementations
import { IssueRawMemoryRepo } from './issue/issue.memory.repo.js';
import { PRRawMemoryRepo } from './pr/pr.memory.repo.js';
import { CommentRawMemoryRepo } from './comment/comment.memory.repo.js';
import { CommitRawMemoryRepo } from './commit/commit.memory.repo.js';
import { UserMemoryRepo } from './user/user.memory.repo.js';
import { RepoRawMemoryRepo } from './repo/repo.memory.repo.js';

// Silver services
import { IssueSilverService } from './issue/issue.service.js';
import { PRSilverService } from './pr/pr.service.js';
import { CommentSilverService } from './comment/comment.service.js';
import { CommitSilverService } from './commit/commit.service.js';
import { UsersSilverService } from './user/user.service.js';
import { ReposSilverService } from './repo/repo.service.js';
import { SilverOrchestratorService } from './orchestrator.js';

const BronzeRepoBindings: Provider[] = [
  { provide: IssueBronzeRepo, useClass: IssueRawMemoryRepo },
  { provide: PRBronzeRepo, useClass: PRRawMemoryRepo },
  { provide: CommentBronzeRepo, useClass: CommentRawMemoryRepo },
  { provide: CommitBronzeRepo, useClass: CommitBronzeRepo },
  { provide: UserBronzeRepo, useClass: UserMemoryRepo },
  { provide: RepoBronzeRepo, useClass: RepoRawMemoryRepo },
];

@Module({
  imports: [GithubModule],
  providers: [
    ...BronzeRepoBindings,
    IssueSilverService,
    PRSilverService,
    CommentSilverService,
    CommitSilverService,
    UsersSilverService,
    ReposSilverService,
    SilverOrchestratorService,
  ],
  exports: [SilverOrchestratorService],
})
export class NormalizedModule {}
