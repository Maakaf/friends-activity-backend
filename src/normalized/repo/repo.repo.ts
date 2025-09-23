import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface BronzeReposRow {
  repo_node: string;            // PK in bronze.github_repos
  full_name: string | null;     // owner/name
  owner_login: string | null;
  name: string | null;
  is_private: boolean | null;
  fetched_at: string | null;    // ISO
  raw_payload: any;
}

@Injectable()
export class RepoBronzeRepo {
  constructor(@Inject(DataSource) private readonly ds: DataSource) {}

  async loadFromBronzeRepos(params: {
    sinceIso?: string;
    untilIso?: string;
    repoIds?: string[];
    owners?: string[];     // filter by owner_login
    names?: string[];      // filter by repo name (not full_name)
    limit?: number;
  }): Promise<BronzeReposRow[]> {
    const { sinceIso, untilIso, repoIds, owners, names, limit } = params;

    const where: string[] = ['1=1'];
    const args: any[] = [];

    if (sinceIso) { where.push(`fetched_at >= $${args.length + 1}`); args.push(sinceIso); }
    if (untilIso) { where.push(`fetched_at <  $${args.length + 1}`); args.push(untilIso); }
    if (repoIds?.length) {
      where.push(`repo_node = ANY($${args.length + 1}::text[])`); args.push(repoIds);
    }
    if (owners?.length) {
      where.push(`owner_login = ANY($${args.length + 1}::text[])`); args.push(owners);
    }
    if (names?.length) {
      where.push(`name = ANY($${args.length + 1}::text[])`); args.push(names);
    }

    const lim = limit && limit > 0 ? `LIMIT ${Number(limit)}` : '';

    const sql = `
      SELECT repo_node, full_name, owner_login, name, is_private, fetched_at, raw_payload
        FROM bronze.github_repos
       WHERE ${where.join(' AND ')}
       ORDER BY fetched_at DESC
       ${lim}
    `;
    return (await this.ds.query(sql, args)) as BronzeReposRow[];
  }
}
