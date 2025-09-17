// src/app.module.ts
import 'dotenv/config';
import { Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller.js';
import { GithubController } from './raw/raw.controller.js';
import { GithubModule } from './raw/raw.module.js';

// --- DB-backed repo *tokens* (we keep these as the DI tokens)
import { IssueBronzeRepo } from './normalized/issue/issue.repo.js';
import { PRBronzeRepo } from './normalized/pr/pr.repo.js';
import { CommentBronzeRepo } from './normalized/comment/comment.repo.js';
import { CommitBronzeRepo } from './normalized/commit/commit.repo.js';
import { UserBronzeRepo } from './normalized/user/user.repo.js';
import { RepoBronzeRepo } from './normalized/repo/repo.repo.js';

// --- Memory-backed implementations (what we'll actually instantiate)
import { IssueRawMemoryRepo } from './normalized/issue/issue.memory.repo.js';
import { PRRawMemoryRepo } from './normalized/pr/pr.memory.repo.js';
import { CommentRawMemoryRepo } from './normalized/comment/comment.memory.repo.js';
import { CommitRawMemoryRepo } from './normalized/commit/commit.memory.repo.js';
import { UserMemoryRepo } from './normalized/user/user.memory.repo.js';
import { RepoRawMemoryRepo } from './normalized/repo/repo.memory.repo.js';

// Silver services (unchanged)
import { IssueSilverService } from './normalized/issue/issue.service.js';
import { PRSilverService } from './normalized/pr/pr.service.js';
import { CommentSilverService } from './normalized/comment/comment.service.js';
import { CommitSilverService } from './normalized/commit/commit.service.js';
import { UsersSilverService } from './normalized/user/user.service.js';
import { ReposSilverService } from './normalized/repo/repo.service.js';
import { SilverOrchestratorService } from './normalized/orchestrator.js';

import dataSource from './database/data-source.js';

function pgConfig() {
  if (process.env.DATABASE_URL) {
    return {
      type: 'postgres' as const,
      url: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      autoLoadEntities: false,
      synchronize: false,
    };
  }
  return {
    ...dataSource.options,
    autoLoadEntities: false,
    synchronize: false,
  };
}

// Always bind the DB *token* to the Memory *class*
const BronzeRepoBindings: Provider[] = [
  { provide: IssueBronzeRepo, useClass: IssueRawMemoryRepo },
  { provide: PRBronzeRepo, useClass: PRRawMemoryRepo },
  { provide: CommentBronzeRepo, useClass: CommentRawMemoryRepo },
  { provide: CommitBronzeRepo, useClass: CommitRawMemoryRepo },
  { provide: UserBronzeRepo, useClass: UserMemoryRepo },
  { provide: RepoBronzeRepo, useClass: RepoRawMemoryRepo },
];

@Module({
  imports: [
    TypeOrmModule.forRoot(pgConfig()), // keep: raw ingest still writes to DB
    GithubModule,                      // exports RawMemoryStore
  ],
  controllers: [AppController, GithubController],
  providers: [
    ...BronzeRepoBindings,    // ← memory-only now
    IssueSilverService,
    PRSilverService,
    CommentSilverService,
    CommitSilverService,
    UsersSilverService,
    ReposSilverService,
    SilverOrchestratorService,
  ],
  exports: [
    IssueSilverService,
    PRSilverService,
    CommentSilverService,
    CommitSilverService,
    UsersSilverService,
    ReposSilverService,
    SilverOrchestratorService,
  ],
})
export class AppModule {}
