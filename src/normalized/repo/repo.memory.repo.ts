// src/normalized/repo/repo.memory.repo.ts
import { Injectable, Inject } from '@nestjs/common';
import type { BronzeReposRow } from './repo.repo.js';
import { RawMemoryStore } from '../../raw/raw-memory.store.js';

@Injectable()
export class RepoRawMemoryRepo {
  constructor(@Inject(RawMemoryStore) private readonly mem: RawMemoryStore) {}

  loadFromBronzeRepos(params: {
    sinceIso?: string;
    untilIso?: string;
    repoIds?: string[];
    owners?: string[];
    names?: string[];
    limit?: number;
  }): BronzeReposRow[] {
    const { sinceIso, untilIso, repoIds, owners, names, limit } = params;

    const allRepos = this.mem.getRepos();

    const rows: BronzeReposRow[] = allRepos
      .map((r) => ({
        repo_node: r.repo_node,
        full_name: r.full_name,
        owner_login: r.owner_login ?? null,
        name: r.name ?? null,
        is_private: r.is_private ?? null,
        fetched_at: r.fetched_at ?? null,
        raw_payload: r.raw_payload,
      }))
      .filter((r) => {
        if (sinceIso && r.fetched_at && r.fetched_at < sinceIso) return false;
        if (untilIso && r.fetched_at && r.fetched_at >= untilIso) return false;
        if (repoIds?.length && !repoIds.includes(r.repo_node)) return false;
        if (owners?.length && r.owner_login && !owners.includes(r.owner_login))
          return false;
        if (names?.length && r.name && !names.includes(r.name)) return false;
        return true;
      })
      .sort((a, b) => (b.fetched_at || '').localeCompare(a.fetched_at || ''));

    return typeof limit === 'number' && limit > 0 ? rows.slice(0, limit) : rows;
  }
}
