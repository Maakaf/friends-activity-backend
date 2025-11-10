import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { BronzeRow } from '../mappers.js';

@Injectable()
export class PRBronzeRepo {
  constructor(@Inject(DataSource) private readonly ds: DataSource) {}

  /**
   * Load pull_request events from bronze for a time window.
   * Optional filters let you target a repo or limit to specific authors.
   */
  async loadSince(params: {
    sinceIso: string;
    untilIso?: string;
    repoId?: string;
    authorUserIds?: string[];
  }): Promise<BronzeRow[]> {
    const { sinceIso, untilIso, repoId, authorUserIds } = params;

    const where: string[] = [`event_type = 'pull_request'`, `created_at >= $1`];
    const args: unknown[] = [sinceIso];

    if (untilIso) { where.push(`created_at < $${args.length + 1}`); args.push(untilIso); }
    if (repoId)   { where.push(`repo_node = $${args.length + 1}`);   args.push(repoId); }
    if (authorUserIds?.length) {
      where.push(`actor_user_node = ANY($${args.length + 1}::text[])`);
      args.push(authorUserIds);
    }

    const sql = `
      SELECT event_ulid, event_type, provider_event_id,
             actor_user_node, repo_node, target_node, created_at, raw_payload
        FROM bronze.github_events
       WHERE ${where.join(' AND ')}
       ORDER BY created_at ASC, event_ulid ASC`;

    const rows = await this.ds.query(sql, args);
    return rows as BronzeRow[];
  }
}
