// src/app.module.ts
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller.js';

import { GithubModule } from './raw/raw.module.js';
import { IssueBronzeRepo } from './normalized/issue/issue.repo.js';
import { IssueSilverService } from './normalized/issue/issue.service.js';
import { PRBronzeRepo } from './normalized/pr/pr.repo.js';
import { PRSilverService } from './normalized/pr/pr.service.js';
import { CommentBronzeRepo } from './normalized/comment/comment.repo.js';
import { CommentSilverService } from './normalized/comment/comment.service.js';
import { CommitBronzeRepo } from './normalized/commit/commit.repo.js';
import { CommitSilverService } from './normalized/commit/commit.service.js';
import { UserBronzeRepo } from './normalized/user/user.repo.js';
import { UserSilverService } from './normalized/user/user.service.js';
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
  ],
  controllers: [AppController],
  providers: [
    //AppService,
    IssueBronzeRepo,
    IssueSilverService,
    PRBronzeRepo,
    PRSilverService,
    CommentBronzeRepo,
    CommentSilverService,
    CommitBronzeRepo, 
    CommitSilverService,
    UserBronzeRepo,
    UserSilverService,
  ],
  exports: [
    IssueSilverService,
    PRSilverService,
    CommentSilverService,
    CommitSilverService,
    UserSilverService,
  ],
})
export class AppModule {}
