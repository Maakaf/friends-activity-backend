
import { Injectable, Logger, Inject } from '@nestjs/common';
import { IssueBronzeRepo } from './issue.repo.js';
import { mapIssue, mergeIssue } from '../mappers.js';
import type { Issue } from '../types.js';

@Injectable()
export class IssueSilverService {
  private readonly log = new Logger(IssueSilverService.name);
  constructor(@Inject(IssueBronzeRepo) private readonly repo: IssueBronzeRepo) {}

  //----------------------- ISSUE --------------------\\
  /**
   * Build Silver Issues from Bronze.
   * - Maps rows
   * - De-dupes by issueId
   * - Keeps the freshest snapshot (by updatedAt/createdAt)
   */
  async getIssuesSince(params: {
    sinceIso: string;
    untilIso?: string;
    repoId?: string;
    authorUserIds?: string[];
    validate?: boolean;  // optional zod toggle
  }): Promise<Issue[]> {
    const { validate = false, ...load } = params;
    const bronzeRows = await this.repo.loadSince(load);

    const byId = new Map<string, Issue>();

    for (const b of bronzeRows) {
      const cur = mapIssue(b);
      if (!cur) continue;

      const prev = byId.get(cur.issueId);
      if (!prev) {
        byId.set(cur.issueId, cur);
      } else {
        byId.set(cur.issueId, mergeIssue(prev, cur));
      }
    }

    const out = [...byId.values()];
/*
    if (validate) {
      // optional: plug in zod here if you add IssueSchema later
      // out.forEach((i) => IssueSchema.parse(i));
    }
*/
    this.log.debug(`silver.issues: ${out.length} (from ${bronzeRows.length} bronze rows)`);
    return out;
  }
}

