import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { BronzeRow } from '../mappers.js';

@Injectable()
export class CommitBronzeRepo {
  constructor(@Inject(DataSource) private readonly ds: DataSource) {}

  async loadSince(params: {
    sinceIso: string;
    untilIso?: string;
    repoId?: string;
    authorUserIds?: string[];
  }): Promise<BronzeRow[]> {
    const { sinceIso, untilIso, repoId, authorUserIds } = params;

    const where: string[] = [`event_type = 'commit'`, `created_at >= $1`];
    const args: unknown[] = [sinceIso];

    if (untilIso) {
      where.push(`created_at < $${args.length + 1}`);
      args.push(untilIso);
    }
    if (repoId) {
      where.push(`repo_node = $${args.length + 1}`);
      args.push(repoId);
    }
    if (authorUserIds?.length) {
      where.push(`actor_user_node = ANY($${args.length + 1}::text[])`);
      args.push(authorUserIds);
    }

    const sql = `
      SELECT e.event_ulid, e.event_type, e.provider_event_id,
             e.actor_user_node, e.repo_node, e.target_node, e.created_at, e.raw_payload
        FROM bronze.github_events e
       WHERE ${where.join(' AND ')}
         AND (
           e.target_node IS NULL  -- Direct commits
           OR EXISTS (            -- PR commits where PR is merged
             SELECT 1 FROM bronze.github_events pr
             WHERE pr.event_type = 'pull_request'
               AND pr.provider_event_id = e.target_node
               AND (pr.raw_payload->>'merged_at' IS NOT NULL
                    OR pr.raw_payload->'pull_request'->>'merged_at' IS NOT NULL)
           )
         )
       ORDER BY e.created_at ASC, e.event_ulid ASC`;

    const rows = await this.ds.query(sql, args);
    return rows as BronzeRow[];
  }
}
