// src/raw/raw-memory.store.ts
import { Injectable } from '@nestjs/common';
import type { RawPayload } from './raw-saver.js';

// Exact bronze table interfaces
export interface BronzeEventsRow {
  event_ulid: string;
  provider: string;
  event_type: string;
  provider_event_id: string;
  actor_user_node?: string | null;
  repo_node?: string | null;
  target_node?: string | null;
  created_at?: string | null;
  received_at?: string | null;
  is_private?: boolean | null;
  raw_payload: RawPayload;
}

export interface BronzeUsersRow {
  user_node: string;
  provider: string;
  login: string;
  name?: string | null;
  fetched_at?: string | null;
  raw_payload: RawPayload;
}

export interface BronzeReposRow {
  repo_node: string;
  provider: string;
  full_name: string;
  owner_login?: string | null;
  name?: string | null;
  is_private?: boolean | null;
  fetched_at?: string | null;
  raw_payload: RawPayload;
}

@Injectable()
export class RawMemoryStore {
  private events = new Map<string, BronzeEventsRow>();
  private users = new Map<string, BronzeUsersRow>();
  private repos = new Map<string, BronzeReposRow>();

  upsertEvent(event: BronzeEventsRow) {
    this.events.set(event.event_ulid, event);
  }

  upsertUser(user: BronzeUsersRow) {
    this.users.set(user.user_node, user);
  }

  upsertRepo(repo: BronzeReposRow) {
    this.repos.set(repo.repo_node, repo);
  }

  getEvents(): BronzeEventsRow[] {
    return Array.from(this.events.values());
  }

  getUsers(): BronzeUsersRow[] {
    return Array.from(this.users.values());
  }

  getRepos(): BronzeReposRow[] {
    return Array.from(this.repos.values());
  }

  removeUserData(userNode: string) {
    // Remove user
    this.users.delete(userNode);
    
    // Remove events by this user
    for (const [eventId, event] of this.events.entries()) {
      if (event.actor_user_node === userNode) {
        this.events.delete(eventId);
      }
    }
  }

  clear() {
    this.events.clear();
    this.users.clear();
    this.repos.clear();
  }
}
