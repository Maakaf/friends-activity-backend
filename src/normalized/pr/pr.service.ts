import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PRBronzeRepo } from './pr.repo.js';
import { mapPR, mergePR } from '../mappers.js';
import { GithubService } from '../../raw/raw.service.js';
import { RawMemoryStore } from '../../raw/raw-memory.store.js';
import type { PR } from '../types.js';
import type { RawPayload } from '../../raw/raw-saver.js';

type AugmentedPRPayload = RawPayload & {
  _repo_owner?: string;
  _repo_name?: string;
  number?: number;
};

type CommitRow = {
  provider_event_id: string;
};

const isCommitRow = (row: unknown): row is CommitRow =>
  typeof row === 'object' &&
  row !== null &&
  typeof (row as { provider_event_id?: unknown }).provider_event_id ===
    'string';

@Injectable()
export class PRSilverService {
  private readonly log = new Logger(PRSilverService.name);
  constructor(
    @Inject(PRBronzeRepo) private readonly repo: PRBronzeRepo,
    @Inject(DataSource) private readonly ds: DataSource,
    @Optional() private readonly githubService?: GithubService,
    @Optional() private readonly memoryStore?: RawMemoryStore,
  ) {}

  /**
   * Build Silver PRs from Bronze.
   * - Maps rows
   * - De-dupes by prId
   * - Keeps the freshest snapshot (by updatedAt/createdAt)
   * - Fetches commits for each PR
   */
  async getPRsSince(params: {
    sinceIso: string;
    untilIso?: string;
    repoId?: string;
    authorUserIds?: string[];
    validate?: boolean; // hook for zod later
  }): Promise<PR[]> {
    const { validate: shouldValidate = false, ...load } = params;
    const bronzeRows = await this.repo.loadSince(load);

    const byId = new Map<string, PR>();
    const prToRepoInfo = new Map<
      string,
      { owner: string; repo: string; number: number }
    >();

    for (const b of bronzeRows) {
      const cur = mapPR(b);
      if (!cur) continue;

      // Extract repo info from augmented payload
      const rp = (b.raw_payload as AugmentedPRPayload | null) ?? {};
      if (rp._repo_owner && rp._repo_name && rp.number) {
        prToRepoInfo.set(cur.prId, {
          owner: rp._repo_owner,
          repo: rp._repo_name,
          number: rp.number,
        });
      }

      const prev = byId.get(cur.prId);
      if (!prev) {
        byId.set(cur.prId, cur);
      } else {
        byId.set(cur.prId, mergePR(prev, cur));
      }
    }

    // Get commits for each PR from bronze layer
    const out = [...byId.values()];
    for (const pr of out) {
      // Query commits where target_node = prId
      const commitSql = `
        SELECT provider_event_id
        FROM bronze.github_events
        WHERE event_type = 'commit' AND target_node = $1
        ORDER BY created_at ASC`;

      const commitRowsRaw: unknown = await this.ds.query(commitSql, [pr.prId]);
      if (!Array.isArray(commitRowsRaw)) {
        this.log.warn(
          `Unexpected commit rows shape for PR ${pr.prId}, skipping commits attachment`,
        );
        continue;
      }

      pr.commits = commitRowsRaw
        .filter(isCommitRow)
        .map((row) => row.provider_event_id);
    }

    if (shouldValidate) {
      this.log.debug('PR validation flag is not yet implemented');
    }

    this.log.debug(
      `silver.prs: ${out.length} (from ${bronzeRows.length} bronze rows)`,
    );
    return out;
  }
}
