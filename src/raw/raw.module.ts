import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GithubService } from './raw.service.js';
import { RawMemoryStore } from './raw-memory.store.js';
import { GITHUB_CLIENT } from './github-client.token.js';
import { OctokitClient } from './octokit-client.js';

@Module({
  imports: [TypeOrmModule.forFeature([])],  // allows InjectDataSource in this module
  controllers: [], // moved GithubController to AppModule
  providers: [
    GithubService,
    RawMemoryStore,
    { provide: GITHUB_CLIENT, useClass: OctokitClient },
  ],
  exports: [GithubService, RawMemoryStore, GITHUB_CLIENT],
})
export class GithubModule { }