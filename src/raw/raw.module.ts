import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GithubController } from './raw.controller.js';
import { GithubService } from './raw.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([])],  // allows InjectDataSource in this module
  controllers: [GithubController],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}