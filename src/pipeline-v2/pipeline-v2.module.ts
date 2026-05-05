import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestModule } from '../ingest/ingest.module.js';
import { PipelineV2Service } from './pipeline-v2.service.js';
import { PipelineV2Controller } from './pipeline-v2.controller.js';
import { AppUserProfileEntity } from '../database/entities/app/user-profile.entity.js';
import { AppRepositoryEntity } from '../database/entities/app/repository.entity.js';
import { AppUserActivityEntity } from '../database/entities/app/user-activity.entity.js';
import { AppUserSyncEntity } from '../database/entities/app/user-sync.entity.js';
import { AppUserDailyContributionEntity } from '../database/entities/app/user-daily-contribution.entity.js';
import { AppUserRollingActivityEntity } from '../database/entities/app/user-rolling-activity.entity.js';

@Module({
  imports: [
    IngestModule,
    TypeOrmModule.forFeature([
      AppUserProfileEntity,
      AppRepositoryEntity,
      AppUserActivityEntity,
      AppUserSyncEntity,
      AppUserDailyContributionEntity,
      AppUserRollingActivityEntity,
    ]),
  ],
  controllers: [PipelineV2Controller],
  providers: [PipelineV2Service],
})
export class PipelineV2Module {}
