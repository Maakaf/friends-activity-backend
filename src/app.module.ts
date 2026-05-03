import 'dotenv/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';

import dataSource from './database/data-source.js';
import { AppController } from './app.controller.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { PipelineModule } from './pipeline/pipeline.module.js';
import { IngestModule } from './ingest/ingest.module.js';
import { PipelineV2Module } from './pipeline-v2/pipeline-v2.module.js';
import { ApiKeyGuard } from './auth/api-key.guard.js';

function pgConfig() {
  if (process.env.DATABASE_URL) {
    const ssl =
      process.env.DATABASE_SSL === 'false'
        ? false
        : { rejectUnauthorized: false };
    return {
      type: 'postgres' as const,
      url: process.env.DATABASE_URL,
      ssl,
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
    AnalyticsModule,
    IngestModule,
    PipelineModule,
    PipelineV2Module,
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
