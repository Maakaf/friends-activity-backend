// src/normalized/user/user.memory.repo.ts
import { Injectable, Inject } from '@nestjs/common';
import type { BronzeUsersRow } from './user.repo.js';
import { RawMemoryStore } from '../../raw/raw-memory.store.js';

@Injectable()
export class UserMemoryRepo {
  constructor(@Inject(RawMemoryStore) private readonly mem: RawMemoryStore) {}

  async loadFromBronzeUsers(params: {
    sinceIso?: string;
    untilIso?: string;
    userIds?: string[];
    logins?: string[];
    limit?: number;
  }): Promise<BronzeUsersRow[]> {
    const { sinceIso, untilIso, userIds, logins, limit } = params;

    const allUsers = this.mem.getUsers();

    const rows: BronzeUsersRow[] = allUsers
      .map((u) => ({
        user_node: u.user_node,
        login: u.login,
        fetched_at: u.fetched_at ?? null,
        raw_payload: u.raw_payload,
      }))
      .filter((r) => {
        if (sinceIso && r.fetched_at && r.fetched_at < sinceIso) return false;
        if (untilIso && r.fetched_at && r.fetched_at >= untilIso) return false;
        if (userIds?.length && !userIds.includes(r.user_node)) return false;
        if (logins?.length && r.login && !logins.includes(r.login)) return false;
        return true;
      })
      .sort((a, b) => (b.fetched_at || '').localeCompare(a.fetched_at || ''));

    return typeof limit === 'number' && limit > 0 ? rows.slice(0, limit) : rows;
  }
}