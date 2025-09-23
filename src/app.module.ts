// src/app.module.ts
import 'dotenv/config';
import { Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';





import dataSource from './database/data-source.js';

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



import { AppController } from './app.controller.js';
import { GithubController } from './raw/raw.controller.js';
import { GithubModule } from './raw/raw.module.js';
import { NormalizedModule } from './normalized/normalized.module.js';

import { CuratedModule } from './analytics/analytics.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(pgConfig()), // keep: raw ingest still writes to DB
    GithubModule,                      // exports RawMemoryStore
    NormalizedModule,
    CuratedModule
  ],
  controllers: [AppController, GithubController],
  providers: [],
  exports: [],
})
export class AppModule {}
