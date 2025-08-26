import { Controller, Post, Param, Query, Inject } from '@nestjs/common';
import { GithubService } from './github.service.js';

@Controller('github')
export class GithubController {
  constructor(@Inject(GithubService) private readonly githubService: GithubService) {}

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
  @Post('ingest/users-strict')
  async ingestUsersStrict(
    @Query('users') users: string,
    @Query('since') since?: string,
    @Query('until') until?: string,
  ) {
    return this.githubService.ingestEachUserInTheirRepos(users, since, until);
  }
}

