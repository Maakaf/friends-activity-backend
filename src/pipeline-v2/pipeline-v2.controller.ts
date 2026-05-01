import { Controller, Post, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { PipelineV2Service } from './pipeline-v2.service.js';

@ApiTags('pipeline-v2')
@ApiSecurity('X-API-Key')
@Controller('pipeline/v2')
export class PipelineV2Controller {
  constructor(private readonly pipeline: PipelineV2Service) {}

  @Get('analytics/report')
  @ApiOperation({
    summary:
      'Generate frontend analytics report (last 180 days, fork_count >= 3) for all users in the DB.',
  })
  getAnalyticsReport() {
    return this.pipeline.generateReport();
  }

  @Post('refreshAll')
  @ApiOperation({ summary: 'Wipe all data and re-ingest from users.json (daily refresh)' })
  refreshAll() {
    return this.pipeline.refreshAll();
  }

  @Get('listUsers')
  @ApiOperation({ summary: 'List users grouped by sync status' })
  listUsers() {
    return this.pipeline.listUsers();
  }
}
