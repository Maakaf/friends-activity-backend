import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiSecurity } from '@nestjs/swagger';
import { PipelineV2Service } from './pipeline-v2.service.js';
import { IngestUsersDto } from '../raw/dto/ingest-users.dto.js';

@ApiTags('pipeline-v2')
@ApiSecurity('X-API-Key')
@Controller('pipeline/v2')
export class PipelineV2Controller {
  constructor(private readonly pipeline: PipelineV2Service) {}

  @Post('analytics/report')
  @ApiOperation({
    summary:
      'Generate frontend analytics report (last 180 days, fork_count >= 3)',
  })
  @ApiBody({ type: IngestUsersDto })
  getAnalyticsReport(@Body() body: IngestUsersDto) {
    return this.pipeline.generateReport(body.users);
  }

  @Post('removeUsers')
  @ApiOperation({ summary: 'Remove users and their activity data' })
  @ApiBody({ type: IngestUsersDto })
  removeUsers(@Body() body: IngestUsersDto) {
    return this.pipeline.removeUsers(body.users);
  }

  @Post('addNewUsers')
  @ApiOperation({ summary: 'Add new users via GraphQL ingest' })
  @ApiBody({ type: IngestUsersDto })
  addNewUsers(@Body() body: IngestUsersDto) {
    return this.pipeline.addNewUsers(body.users);
  }

  @Get('listUsers')
  @ApiOperation({ summary: 'List users grouped by sync status' })
  listUsers() {
    return this.pipeline.listUsers();
  }
}
