import { Injectable, Logger, Inject } from '@nestjs/common';
import type { Repository } from './types.js';
import { RepoBronzeRepo } from './repo.repo.js';
import { mapRepoFromBronzeRow } from './mappers.js';

@Injectable()
export class ReposSilverService {
  private readonly log = new Logger(ReposSilverService.name);
  constructor(@Inject(RepoBronzeRepo) private readonly repo: RepoBronzeRepo) {}

  async getReposSince(params: {
    sinceIso?: string;
    untilIso?: string;
    repoIds?: string[];
    owners?: string[];
    names?: string[];
    limit?: number;
  }): Promise<Repository[]> {
    const rows = await this.repo.loadFromBronzeRepos(params);
    const repos: Repository[] = [];

    for (const row of rows) {
      const r = mapRepoFromBronzeRow(row);
      if (r) repos.push(r);
    }

    this.log.debug(`silver.repos: ${repos.length} (from ${rows.length} bronze rows)`);
    return repos;
  }
}
