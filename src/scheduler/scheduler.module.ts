import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerService } from './scheduler.service.js';
import { UserSyncStatus } from './sync-status.entity.js';
import { SyncStatusRepo } from './sync-status.repo.js';
import { PipelineModule } from '../pipeline/pipeline.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([UserSyncStatus]),
    PipelineModule,
  ],
  providers: [SchedulerService, SyncStatusRepo],
  exports: [SchedulerService, SyncStatusRepo],
})
export class SchedulerModule {}