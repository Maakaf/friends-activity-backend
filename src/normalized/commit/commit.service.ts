import { Injectable, Logger, Inject } from '@nestjs/common';
import { CommitBronzeRepo } from './commit.repo.js';
import { mapCommit, mergeCommit } from '../mappers.js';
import type { Commit } from '../types.js';

@Injectable()
export class CommitSilverService {
  private readonly log = new Logger(CommitSilverService.name);
  constructor(@Inject(CommitBronzeRepo) private readonly repo: CommitBronzeRepo) {}

  /**
   * Build Silver Commits from Bronze.
   * - Maps rows
   * - De-dupes by commitId (sha)
   * - Prefers the entry with later createdAt / richer message
   */
  async getCommitsSince(params: {
    sinceIso: string;
    untilIso?: string;
    repoId?: string;
    authorUserIds?: string[];
  }): Promise<Commit[]> {
    const bronzeRows = await this.repo.loadSince(params);

    const byId = new Map<string, Commit>();
    for (const b of bronzeRows) {
      const cur = mapCommit(b);
      if (!cur) continue;

      const prev = byId.get(cur.commitId);
      if (!prev) {
        byId.set(cur.commitId, cur);
      } else {
        byId.set(cur.commitId, mergeCommit(prev, cur));
      }
    }

    const out = [...byId.values()];
    this.log.debug(`silver.commits: ${out.length} (from ${bronzeRows.length} bronze rows)`);
    return out;
  }
}
