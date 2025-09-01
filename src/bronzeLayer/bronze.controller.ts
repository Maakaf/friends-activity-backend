import { Controller, Post, Param, Query, Inject, Body, BadRequestException } from '@nestjs/common';
import { BronzeService } from './bronze.service.js';

type IngestUsersBody = { users: string[] };

@Controller('bronzeLayer')
export class BronzeController {
  constructor(@Inject(BronzeService) private readonly githubService: BronzeService) {}

  // POST /bronzeLayer/ingest/org/Maakaf?users=barlavi1,UrielOfir&since=2025-02-19T00:00:00Z&until=2025-03-01T00:00:00Z
  @Post('ingest/org/:org')
  async ingestOrgForUsers(
    @Param('org') org: string,
    @Query('users') users?: string,
    @Query('since') since?: string,
    @Query('until') until?: string,
  ) {
    return this.githubService.ingestOrgForUsers(org, users ?? '', since, until);
  }
  //POST /bronzeLayer/ingest/users-strict  with JSON body: { "users": ["barlavi1", "UrielOfir"] }
  @Post('ingest/users-strict')
  async ingestUsersStrict(@Body() body: IngestUsersBody) {
    if (!body || !Array.isArray(body.users) || body.users.length === 0) {
      throw new BadRequestException('Body must be { "users": string[] } with at least one username.');
    }
    // since/until are NOT taken from the request; service sets: since=180 days ago, until=now
    return this.githubService.ingestEachUserInTheirRepos(body.users);
  }
}

