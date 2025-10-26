import { Module } from '@nestjs/common';
import { PipelineController } from './pipeline.controller.js';
import { PipelineService } from './pipeline.service.js';
import { RawModule } from '../raw/raw.module.js';
import { NormalizedModule } from '../normalized/normalized.module.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';

@Module({
  imports: [RawModule, NormalizedModule, AnalyticsModule],
  controllers: [PipelineController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
