// src/normalized/commit/commit.memory.repo.ts
import { Injectable, Inject } from '@nestjs/common';
import type { BronzeRow } from '../mappers.js';
import { RawMemoryStore } from '../../raw/raw-memory.store.js';
import type { RawPayload } from '../../raw/raw-saver.js';

type PullRequestPayload = RawPayload & {
  merged_at?: string | null;
  pull_request?: { merged_at?: string | null } | null;
};

@Injectable()
export class CommitRawMemoryRepo {
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
      .filter(e => e.event_type === 'commit')
      .filter(e => e.created_at && e.created_at >= sinceIso)
      .filter(e => !untilIso || (e.created_at && e.created_at < untilIso))
      .filter(e => !repoId || e.repo_node === repoId)
      .filter(e => !authorUserIds?.length || (e.actor_user_node && authorUserIds.includes(e.actor_user_node)))
      .filter(e => {
        // Include commits that are either:
        // 1. Regular commits (target_node is null) - these are already "merged" to main branch
        // 2. Commits linked to merged PRs (target_node points to a merged PR)
        if (!e.target_node) return true; // Regular commit
        
        // Check if the linked PR is merged
        const linkedPR = allEvents.find(pr => 
          pr.event_type === 'pull_request' && 
          pr.provider_event_id === e.target_node
        );
        
        if (!linkedPR?.raw_payload) return false;
        
        const rp = linkedPR.raw_payload as PullRequestPayload | null;
        const mergedAt = rp?.merged_at ?? rp?.pull_request?.merged_at ?? null;
        return mergedAt != null;
      })
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
