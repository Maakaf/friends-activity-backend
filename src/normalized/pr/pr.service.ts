import { Injectable, Logger, Inject } from '@nestjs/common';
import { PRBronzeRepo } from './pr.repo.js';
import { mapPR, mergePR } from '../mappers.js';
import type { PR } from '../types.js';

@Injectable()
export class PRSilverService {
  private readonly log = new Logger(PRSilverService.name);
  constructor(@Inject(PRBronzeRepo) private readonly repo: PRBronzeRepo) {}

  /**
   * Build Silver PRs from Bronze.
   * - Maps rows
   * - De-dupes by prId
   * - Keeps the freshest snapshot (by updatedAt/createdAt)
   */
  async getPRsSince(params: {
    sinceIso: string;
    untilIso?: string;
    repoId?: string;
    authorUserIds?: string[];
    validate?: boolean; // hook for zod later
  }): Promise<PR[]> {
    const { validate = false, ...load } = params;
    const bronzeRows = await this.repo.loadSince(load);

    const byId = new Map<string, PR>();

    for (const b of bronzeRows) {
      const cur = mapPR(b);
      if (!cur) continue;

      const prev = byId.get(cur.prId);
      if (!prev) {
        byId.set(cur.prId, cur);
      } else {
        byId.set(cur.prId, mergePR(prev, cur));
      }
    }

    const out = [...byId.values()];
    // if (validate) out.forEach((p) => PRSchema.parse(p));

    this.log.debug(`silver.prs: ${out.length} (from ${bronzeRows.length} bronze rows)`);
    return out;
  }
}
