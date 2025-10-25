// src/app.module.ts
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';

import dataSource from './database/data-source.js';
import { AppController } from './app.controller.js';
import { GithubModule } from './raw/raw.module.js';
import { NormalizedModule } from './normalized/normalized.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { PipelineModule } from './pipeline/pipeline.module.js';
import { ApiKeyGuard } from './auth/api-key.guard.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';

function pgConfig() {
  if (process.env.DATABASE_URL) {
    return {
      type: 'postgres' as const,
      url: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      autoLoadEntities: true,
      synchronize: false,
    };
  }
  return {
    ...dataSource.options,
    autoLoadEntities: true,
    synchronize: false,
  };
}

@Module({
  imports: [
    TypeOrmModule.forRoot(pgConfig()),
    GithubModule,
    NormalizedModule,
    AnalyticsModule,
    PipelineModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
