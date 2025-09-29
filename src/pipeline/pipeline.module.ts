import { Module } from '@nestjs/common';
import { PipelineService } from './pipeline.service.js';
import { PipelineController } from './pipeline.controller.js';
import { GithubModule } from '../raw/raw.module.js';
import { NormalizedModule } from '../normalized/normalized.module.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';

@Module({
  imports: [GithubModule, NormalizedModule, AnalyticsModule],
  controllers: [PipelineController],
  providers: [PipelineService],
})
export class PipelineModule {}
