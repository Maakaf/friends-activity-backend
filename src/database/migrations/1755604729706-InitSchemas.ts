import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchemas1755604729706 implements MigrationInterface {
  name = 'InitSchemas1755604729706';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS bronze');
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS gold');
    
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS bronze.github_events (
      event_ulid        TEXT PRIMARY KEY,
      provider          TEXT NOT NULL DEFAULT 'bronzeLayer',
      event_type        TEXT,
      provider_event_id TEXT,
      actor_user_node   TEXT,
      repo_node         TEXT,
      target_node       TEXT,
      created_at        TIMESTAMPTZ,
      received_at       TIMESTAMPTZ DEFAULT now(),
      is_private        BOOLEAN,
      raw_payload       JSONB NOT NULL
    )`);
    
    await queryRunner.query('CREATE INDEX IF NOT EXISTS ix_github_events_created ON bronze.github_events (created_at DESC)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS ix_github_events_repo ON bronze.github_events (repo_node)');
    
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS gold.user_activity (
      user_id        TEXT NOT NULL,
      day            DATE NOT NULL,
      repo_id        TEXT NOT NULL,
      activity_type  TEXT NOT NULL,
      activity_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, day, repo_id, activity_type)
    )`);
    
    await queryRunner.query('CREATE INDEX IF NOT EXISTS ix_user_activity_day ON gold.user_activity (day DESC)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP SCHEMA IF EXISTS gold CASCADE');
    await queryRunner.query('DROP SCHEMA IF EXISTS bronze CASCADE');
  }
}
