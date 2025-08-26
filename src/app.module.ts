// src/app.module.ts
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { GithubModule } from './github/github.module.js';
import dataSource from './database/data-source.js';

@Module({
  imports: [
    // Use the same options as the CLI (data-source.ts)
    TypeOrmModule.forRoot({
      ...dataSource.options,     // includes type, url, ssl, schema, migrations, etc.
      autoLoadEntities: false,
      // Never sync in prod; migrations handle schema
      synchronize: false,
    }),
    GithubModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
