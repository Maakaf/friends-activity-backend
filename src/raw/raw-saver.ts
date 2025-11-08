
import { DataSource } from 'typeorm';

export type RawPayload = Record<string, unknown>;

export interface BronzeRow {
  event_ulid: string;
  provider: 'github';
  event_type: string;
  provider_event_id: string;
  actor_user_node?: string | null;
  repo_node?: string | null;
  target_node?: string | null;
  created_at?: string | null; // ISO string
  received_at?: string | null; // you can ignore; DB defaults now()
  is_private?: boolean | null;
  raw_payload: RawPayload;
}

export async function insertBronze(ds: DataSource, row: BronzeRow) {
  await ds.query(
    `
    INSERT INTO bronze.github_events
      (event_ulid, provider, event_type, provider_event_id,
       actor_user_node, repo_node, target_node, created_at, received_at,
       is_private, raw_payload)
    VALUES
      ($1,'github',$2,$3,$4,$5,$6,$7, now(), $8, $9::jsonb)
    ON CONFLICT (event_ulid) DO NOTHING
    `,
    [
      row.event_ulid,
      row.event_type,
      row.provider_event_id,
      row.actor_user_node ?? null,
      row.repo_node ?? null,
      row.target_node ?? null,
      row.created_at ?? null,
      row.is_private ?? null,
      JSON.stringify(row.raw_payload),
    ],
  );
}

/* -------- Bronze users -------- */
export interface BronzeUserRow {
  user_node: string;       // GitHub numeric id, as text
  login: string;
  name?: string | null;
  raw_payload: RawPayload;
}

/** Upsert latest user payload into bronze.github_users */
export async function upsertBronzeUser(ds: DataSource, row: BronzeUserRow) {
  await ds.query(
    `
    INSERT INTO bronze.github_users
      (user_node, provider, login, name, fetched_at, raw_payload, processing_status)
    VALUES
      ($1, 'github', $2, $3, now(), $4::jsonb, 'processing')
    ON CONFLICT (user_node) DO UPDATE
      SET login = EXCLUDED.login,
          name  = EXCLUDED.name,
          fetched_at = now(),
          raw_payload = EXCLUDED.raw_payload
    `,
    [row.user_node, row.login, row.name ?? null, JSON.stringify(row.raw_payload)]
  );
}

/** Insert user with specific processing status (for new users) */
export async function insertBronzeUserWithStatus(
  ds: DataSource, 
  row: BronzeUserRow, 
  status: 'ready' | 'processing' | 'failed' = 'ready'
) {
  await ds.query(
    `
    INSERT INTO bronze.github_users
      (user_node, provider, login, name, fetched_at, raw_payload, processing_status)
    VALUES
      ($1, 'github', $2, $3, now(), $4::jsonb, $5)
    ON CONFLICT (user_node) DO NOTHING
    `,
    [row.user_node, row.login, row.name ?? null, JSON.stringify(row.raw_payload), status]
  );
}

/* -------- Bronze repos -------- */
export interface BronzeRepoRow {
  repo_node: string;       // GitHub numeric id, as text
  full_name: string;       // owner/name
  owner_login?: string | null;
  name?: string | null;
  is_private?: boolean | null;
  raw_payload: RawPayload;
}

/** Upsert latest repo payload into bronze.github_repos */
export async function upsertBronzeRepo(ds: DataSource, row: BronzeRepoRow) {
  await ds.query(
    `
    INSERT INTO bronze.github_repos
      (repo_node, provider, full_name, owner_login, name, is_private, fetched_at, raw_payload)
    VALUES
      ($1, 'github', $2, $3, $4, $5, now(), $6::jsonb)
    ON CONFLICT (repo_node) DO UPDATE
      SET full_name   = EXCLUDED.full_name,
          owner_login = EXCLUDED.owner_login,
          name        = EXCLUDED.name,
          is_private  = EXCLUDED.is_private,
          fetched_at  = now(),
          raw_payload = EXCLUDED.raw_payload
    `,
    [
      row.repo_node,
      row.full_name,
      row.owner_login ?? null,
      row.name ?? null,
      row.is_private ?? null,
      JSON.stringify(row.raw_payload),
    ]
  );
}
