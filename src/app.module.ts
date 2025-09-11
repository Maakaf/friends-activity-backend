// src/app.module.ts
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller.js';

import { GithubModule } from './raw/raw.module.js';
import { IssueBronzeRepo } from './normalized/issue.repo.js';
import { IssueSilverService } from './normalized/issue.service.js';
import { PRBronzeRepo } from './normalized/pr.repo.js';
import { PRSilverService } from './normalized/pr.service.js';
import { CommentBronzeRepo } from './normalized/comment.repo.js';
import { CommentSilverService } from './normalized/comment.service.js';
import { CommitBronzeRepo } from './normalized/commit.repo.js';
import { CommitSilverService } from './normalized/commit.service.js';
import { UserBronzeRepo } from './normalized/user.repo.js';
import { UserSilverService } from './normalized/user.service.js';
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
