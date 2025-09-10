import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IssueSilverService } from './issue.service.js';

// Entities
import { UserEntity } from './entities/user.entity.js';
import { RepositoryEntity } from './entities/repository.entity.js';
import { CommitEntity } from './entities/commit.entity.js';
import { CommentEntity } from './entities/comment.entity.js';
import { IssueEntity } from './entities/issue.entity.js';
import {PullRequestEntity} from './entities/pr.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      RepositoryEntity,
      CommitEntity,
      CommentEntity,
      IssueEntity,
      PullRequestEntity,
    ]),
  ],
  providers: [IssueSilverService],
  exports: [IssueSilverService], // so Gold layer or schedulers can use it
})
export class SilverModule {}
