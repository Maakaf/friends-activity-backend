
import { DataSource } from 'typeorm';

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
  raw_payload: any;
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
