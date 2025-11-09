import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { RawPayload } from '../../raw/raw-saver.js';

export interface BronzeUsersRow {
  user_node: string;            // PK in bronze.github_users
  login: string | null;
  fetched_at: string | null;    // ISO
  raw_payload: RawPayload | null;
}

@Injectable()
export class UserBronzeRepo {
  constructor(@Inject(DataSource) private readonly ds: DataSource) {}

  async loadFromBronzeUsers(params: {
    sinceIso?: string;
    untilIso?: string;
    userIds?: string[];
    logins?: string[];
    limit?: number;
  }): Promise<BronzeUsersRow[]> {
    const { sinceIso, untilIso, userIds, logins, limit } = params;

    const where: string[] = ['1=1'];
    const args: unknown[] = [];

    if (sinceIso) { where.push(`fetched_at >= $${args.length + 1}`); args.push(sinceIso); }
    if (untilIso) { where.push(`fetched_at <  $${args.length + 1}`); args.push(untilIso); }
    if (userIds?.length) {
      where.push(`user_node = ANY($${args.length + 1}::text[])`); args.push(userIds);
    }
    if (logins?.length) {
      where.push(`login = ANY($${args.length + 1}::text[])`); args.push(logins);
    }

    const lim = limit && limit > 0 ? `LIMIT ${Number(limit)}` : '';

    const sql = `
      SELECT user_node, login, fetched_at, raw_payload
        FROM bronze.github_users
       WHERE ${where.join(' AND ')}
       ORDER BY fetched_at DESC
       ${lim}
    `;
    return (await this.ds.query(sql, args)) as BronzeUsersRow[];
  }
}
