import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GithubController } from './raw.controller.js';
import { GithubService } from './raw.service.js';
import { RawMemoryStore } from './raw-memory.store.js';

@Module({
  imports: [TypeOrmModule.forFeature([])],  // allows InjectDataSource in this module
  controllers: [], // moved GithubController to AppModule
  providers: [GithubService, RawMemoryStore],
  exports: [GithubService, RawMemoryStore],
})
export class GithubModule {}