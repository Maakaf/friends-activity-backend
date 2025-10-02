// src/normalized/comment/comment.memory.repo.ts
import { Injectable, Inject } from '@nestjs/common';
import type { BronzeRow } from '../mappers.js';
import { RawMemoryStore } from '../../raw/raw-memory.store.js';

@Injectable()
export class CommentRawMemoryRepo {
  constructor(@Inject(RawMemoryStore) private readonly mem: RawMemoryStore) {}

  async loadSince(params: {
    sinceIso: string;
    untilIso?: string;
    repoId?: string;
    authorUserIds?: string[];
  }): Promise<BronzeRow[]> {
    const { sinceIso, untilIso, repoId, authorUserIds } = params;

    const allEvents = this.mem.getEvents();
    
    return allEvents
      .filter(e => e.event_type === 'issue_comment' || e.event_type === 'pr_review_comment')
      .filter(e => e.created_at && e.created_at >= sinceIso)
      .filter(e => !untilIso || (e.created_at && e.created_at < untilIso))
      .filter(e => !repoId || e.repo_node === repoId)
      .filter(e => !authorUserIds?.length || (e.actor_user_node && authorUserIds.includes(e.actor_user_node)))
      .map(e => ({
        event_ulid: e.event_ulid,
        provider: e.provider as 'github',
        event_type: e.event_type,
        provider_event_id: e.provider_event_id,
        actor_user_node: e.actor_user_node ?? null,
        repo_node: e.repo_node ?? null,
        target_node: e.target_node ?? null,
        created_at: e.created_at ?? null,
        received_at: e.received_at ?? null,
        is_private: e.is_private ?? null,
        raw_payload: e.raw_payload,
      }))
      .sort((a, b) => {
        const timeCompare = (a.created_at || '').localeCompare(b.created_at || '');
        return timeCompare !== 0 ? timeCompare : a.event_ulid.localeCompare(b.event_ulid);
      });
  }
}