import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface LatestActorRow {
  actor_user_node: string;
  created_at: string | null;
  raw_payload: any;
}

@Injectable()
export class UserBronzeRepo {
  constructor(@Inject(DataSource) private readonly ds: DataSource) {}

  /**
   * Returns ONE latest bronze row per actor_user_node since 'sinceIso'.
   * Optional narrowing by untilIso / repoId.
   */
  async loadLatestByActor(params: {
    sinceIso: string;
    untilIso?: string;
    repoId?: string;
  }): Promise<LatestActorRow[]> {
    const { sinceIso, untilIso, repoId } = params;

    const wh: string[] = [`actor_user_node IS NOT NULL`, `created_at >= $1`];
    const args: any[] = [sinceIso];

    if (untilIso) { wh.push(`created_at < $${args.length + 1}`); args.push(untilIso); }
    if (repoId)   { wh.push(`repo_node = $${args.length + 1}`);   args.push(repoId); }

    const sql = `
      SELECT DISTINCT ON (actor_user_node)
             actor_user_node,
             created_at,
             raw_payload
        FROM bronze.github_events
       WHERE ${wh.join(' AND ')}
       ORDER BY actor_user_node, created_at DESC, event_ulid DESC
    `;

    const rows = await this.ds.query(sql, args);
    return rows as LatestActorRow[];
  }
}
