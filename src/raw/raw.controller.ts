// Right now controller doing nothing, should consider opening API endpoints for raw only (for testing maybe?)
//
// import { Controller } from '@nestjs/common';
// import { ApiTags } from '@nestjs/swagger';
// import { GithubService } from './raw.service.js';
//
// @ApiTags('github')
// @Controller('github')
// export class GithubController {
//   constructor(private readonly githubService: GithubService) {}
//
//   /*
//   @Post('ingest/org/:org')
//   @ApiOperation({ summary: 'Fetch raw GitHub data for an org and save to Bronze tables' })
//   ingestOrgForUsers(
//     @Param('org') org: string,
//     @Query('users') users?: string,
//     @Query('since') since?: string,
//     @Query('until') until?: string,
//   ) {
//     return this.githubService.ingestOrgForUsers(org, users ?? '', since, until);
//   }
//    */
// }
