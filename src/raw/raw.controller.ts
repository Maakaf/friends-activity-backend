import { Controller, Post, Param, Query, Inject, Body, BadRequestException } from '@nestjs/common';
import { GithubService } from './raw.service.js';
import { SilverOrchestratorService } from '../normalized/orchestrator.js';
import { ApiBody, ApiTags, ApiOperation } from '@nestjs/swagger';
import { IngestUsersDto } from './dto/ingest-users.dto.js';
type IngestUsersBody = { users: string[] };

@ApiTags('github')

@Controller('github')
export class GithubController {
  constructor(
    @Inject(GithubService) private readonly githubService: GithubService,
    @Inject(SilverOrchestratorService) private readonly silver: SilverOrchestratorService,
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
   @ApiOperation({ summary: 'Ingest per-user repos data AND return silver analysis' })
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
    
    return {
      bronze: ingestResult,
      silver: {
        message: 'Silver layer analysis (reading from memory)',
        counts: {
          users: silverBundle.users?.length || 0,
          repos: silverBundle.repos?.length || 0,
          issues: silverBundle.issues?.length || 0,
          prs: silverBundle.prs?.length || 0,
          comments: silverBundle.comments?.length || 0,
          commits: silverBundle.commits?.length || 0,
        },
        sample: {
          firstUser: silverBundle.users?.[0] || null,
          firstRepo: silverBundle.repos?.[0] || null,
        }
      }
    };
  }
}