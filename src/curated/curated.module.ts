import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuratedService } from './curated.service.js';

import { UserProfileEntity } from './user_profile/user_profile.entity.js';
import { UserActivityEntity } from './user_activity/user_activity.entity.js';
import { RepositoryEntity } from './repository/repository.entity.js';

import { UserProfileRepo } from './user_profile/user_profile.repo.js';
import { UserActivityRepo } from './user_activity/user_activity.repo.js';
import { RepositoryRepo } from './repository/repository.repo.js';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserProfileEntity,
      UserActivityEntity,
      RepositoryEntity,
    ]),
  ],
  providers: [
    CuratedService,
    UserProfileRepo,
    UserActivityRepo,
    RepositoryRepo,
  ],
  exports: [CuratedService],
})
export class CuratedModule {}
