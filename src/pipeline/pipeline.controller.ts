import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiSecurity } from '@nestjs/swagger';
import { PipelineService } from './pipeline.service.js';
import { IngestUsersDto } from '../raw/dto/ingest-users.dto.js';

@ApiTags('pipeline')
@ApiSecurity('X-API-Key') // Add this
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {
    // TEMP sanity check
    console.log('PipelineController DI ok?', !!pipeline);
  }

  @Post('stats')
  @ApiOperation({
    summary:
      'Run full Raw → Silver → Curated → Analytics pipeline for given users',
  })
  @ApiBody({ type: IngestUsersDto })
  ingestUsersStrict(@Body() body: IngestUsersDto) {
    return this.pipeline.run(body.users);
  }

  @Post('analytics/report')
  @ApiOperation({
    summary:
      'Generate frontend analytics report from normalized data (last 180 days, fork_count >= 3)',
  })
  @ApiBody({ type: IngestUsersDto })
  getAnalyticsReport(@Body() body: IngestUsersDto) {
    return this.pipeline.generateReport(body.users);
  }

  @Post('removeUsers')
  @ApiOperation({
    summary: 'Remove users and their data from all database tables',
  })
  @ApiBody({ type: IngestUsersDto })
  removeUsers(@Body() body: IngestUsersDto) {
    return this.pipeline.removeUsers(body.users);
  }

  @Post('addNewUsers')
  @ApiOperation({
    summary: 'Add new users with async processing (last 6 months data)',
  })
  @ApiBody({ type: IngestUsersDto })
  addNewUsers(@Body() body: IngestUsersDto) {
    return this.pipeline.addNewUsers(body.users);
  }

  @Get('listUsers')
  @ApiOperation({
    summary: 'List all users grouped by their processing status',
  })
  listUsers() {
    return this.pipeline.listUsers();
  }
}
