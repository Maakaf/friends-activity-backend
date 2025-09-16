import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { BronzeRow } from '../mappers.js';

@Injectable()
export class IssueBronzeRepo {
  constructor(@Inject(DataSource) private readonly ds: DataSource) {}

  /**
   * Load issue events from bronze for a time window.
   * Optional filters let you target a repo or limit to specific authors.
   */
  async loadSince(params: {
    sinceIso: string;
    untilIso?: string;
    repoId?: string;            // optional: filter to one repo
    authorUserIds?: string[];   // optional: filter to specific authors
  }): Promise<BronzeRow[]> {
    const { sinceIso, untilIso, repoId, authorUserIds } = params;

    const where: string[] = [`event_type = 'issue'`, `created_at >= $1`];
    const args: any[] = [sinceIso];

    if (untilIso) { where.push(`created_at < $${args.length + 1}`); args.push(untilIso); }
    if (repoId)   { where.push(`repo_node = $${args.length + 1}`);   args.push(repoId); }
    if (authorUserIds?.length) {
      // Postgres ANY(string[]) pattern
      where.push(`actor_user_node = ANY($${args.length + 1})`);
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
