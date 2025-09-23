import { Controller, Post, Get, Param, Query, Inject, Body, BadRequestException } from '@nestjs/common';
import { GithubService } from './raw.service.js';
import { SilverOrchestratorService } from '../normalized/orchestrator.js';
import { CuratedService } from '../analytics/analytics.service.js';
import { AnalyticsReportService } from '../analytics/analytics-report.service.js';
import { ApiBody, ApiTags, ApiOperation } from '@nestjs/swagger';
import { IngestUsersDto } from './dto/ingest-users.dto.js';
type IngestUsersBody = { users: string[] };

@ApiTags('github')

@Controller('github')
export class GithubController {
  constructor(
    @Inject(GithubService) private readonly githubService: GithubService,
    @Inject(SilverOrchestratorService) private readonly silver: SilverOrchestratorService,
    @Inject(CuratedService) private readonly curated: CuratedService,
    @Inject(AnalyticsReportService) private readonly analytics: AnalyticsReportService,
  ) {}

  /*
  // POST /github/ingest/org/Maakaf?users=barlavi1,UrielOfir&since=2025-02-19T00:00:00Z&until=2025-03-01T00:00:00Z
  @Post('ingest/org/:org')
  async ingestOrgForUsers(
    @Param('org') org: string,
    @Query('users') users?: string,
    @Query('since') since?: string,
    @Query('until') until?: string,
  ) {
    return this.githubService.ingestOrgForUsers(org, users ?? '', since, until);
  }
  */

  //POST /github/ingest/users-strict  with JSON body: { "users": ["barlavi1", "UrielOfir"] }
  @Post('ingest/users-strict')
   @ApiOperation({ summary: 'Complete pipeline: Raw->Silver->Curated->Frontend JSON (last 180 days, fork_count >= 3)' })
   @ApiBody({ type: IngestUsersDto })
   async ingestUsersStrict(@Body() body: IngestUsersBody) {
    if (!body || !Array.isArray(body.users) || body.users.length === 0) {
      throw new BadRequestException('Body must be { "users": string[] } with at least one username.');
    }
    
    // 1. Bronze layer: Ingest data (writes to DB + memory)
    const ingestResult = await this.githubService.ingestEachUserInTheirRepos(body.users);
    
    // 2. Silver layer: Analyze data (reads from memory)
    const silverBundle = await this.silver.buildBundle({
      sinceIso: ingestResult.since,
      untilIso: ingestResult.until,
    });
    
    // 3. Curated layer: Transform and save to analytics tables
    await this.curated.refreshAll();
    
    // 4. Generate frontend report from analytics tables
    const frontendReport = await this.analytics.generateFrontendReport(body.users);
    
    return frontendReport;
  }

  @Post('analytics/report')
  @ApiOperation({ summary: 'Generate frontend analytics report from normalized data (last 180 days, fork_count >= 3)' })
  @ApiBody({ type: IngestUsersDto })
  async getAnalyticsReport(@Body() body: IngestUsersBody) {
    if (!body || !Array.isArray(body.users) || body.users.length === 0) {
      throw new BadRequestException('Body must be { "users": string[] } with at least one username.');
    }
    
    // Refresh curated data from normalized layer before generating report
    await this.curated.refreshAll();
    
    return this.analytics.generateFrontendReport(body.users);
  }
}