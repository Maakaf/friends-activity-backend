import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsReportService } from './analytics-report.service.js';
import { NormalizedModule } from '../normalized/normalized.module.js';

import { UserProfileEntity } from './user_profile/user_profile.entity.js';
import { UserActivityEntity } from './user_activity/user_activity.entity.js';
import { RepositoryEntity } from './repository/repository.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserProfileEntity,
      UserActivityEntity,
      RepositoryEntity,
    ]),
    NormalizedModule,
  ],
  providers: [AnalyticsService, AnalyticsReportService],
  exports: [AnalyticsService, AnalyticsReportService],
})
export class AnalyticsModule {}
