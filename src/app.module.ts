// src/app.module.ts
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller.js';

import { GithubModule } from './raw/raw.module.js';

import { CuratedModule } from './curated/curated.module.js';

/* tmp modules for testing and debugging */
import { IssueBronzeRepo } from './normalized/issue/issue.repo.js';
import { IssueSilverService } from './normalized/issue/issue.service.js';
import { PRBronzeRepo } from './normalized/pr/pr.repo.js';
import { PRSilverService } from './normalized/pr/pr.service.js';
import { CommentBronzeRepo } from './normalized/comment/comment.repo.js';
import { CommentSilverService } from './normalized/comment/comment.service.js';
import { CommitBronzeRepo } from './normalized/commit/commit.repo.js';
import { CommitSilverService } from './normalized/commit/commit.service.js';
import { UserBronzeRepo } from './normalized/user/user.repo.js';
import { UsersSilverService } from './normalized/user/user.service.js';
import { RepoBronzeRepo } from './normalized/repo/repo.repo.js';
import { ReposSilverService } from './normalized/repo/repo.service.js';
/* end tmp modules for testing and debugging */

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

@Module({
  imports: [
    TypeOrmModule.forRoot(pgConfig()),
    GithubModule,
    CuratedModule
  ],
  controllers: [AppController],
  providers: [
    /* tmp providers for testing and debugging */
    IssueBronzeRepo,
    IssueSilverService,
    PRBronzeRepo,
    PRSilverService,
    CommentBronzeRepo,
    CommentSilverService,
    CommitBronzeRepo, 
    CommitSilverService,
    UserBronzeRepo,
    UsersSilverService,
    RepoBronzeRepo,
    ReposSilverService,
    /* end tmp providers for testing and debugging */
    SilverOrchestratorService,
  ],
  exports: [
    /* tmp exports for testing and debugging */
    IssueSilverService,
    PRSilverService,
    CommentSilverService,
    CommitSilverService,
    UsersSilverService,
    ReposSilverService,
    /* end tmp exports for testing and debugging */
    SilverOrchestratorService
  ],
})
export class AppModule {}
