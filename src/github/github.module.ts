import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],  // allows InjectDataSource in this module
  controllers: [GithubController],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
