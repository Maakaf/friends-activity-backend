import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { PipelineService } from './pipeline.service.js';
import { IngestUsersDto } from '../raw/dto/ingest-users.dto.js'; // reuse same DTO

@ApiTags('pipeline')
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {
      // TEMP sanity check
    console.log('PipelineController DI ok?', !!pipeline);
  }
  @Post('stats')
  @ApiOperation({
    summary: 'Run full Raw → Silver → Curated → Analytics pipeline for given users',
  })
  @ApiBody({ type: IngestUsersDto })
  ingestUsersStrict(@Body() body: IngestUsersDto) {
    return this.pipeline.run(body.users);
  }

  @Post('analytics/report')
  @ApiOperation({
    summary: 'Generate frontend analytics report from normalized data (last 180 days, fork_count >= 3)',
  })
  @ApiBody({ type: IngestUsersDto })
  getAnalyticsReport(@Body() body: IngestUsersDto) {
    return this.pipeline.generateReport(body.users);
  }
}
