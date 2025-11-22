import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoldRepository1755616000000 implements MigrationInterface {
  name = 'AddGoldRepository1755616000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gold.repository (
        repo_id         TEXT PRIMARY KEY,             -- GitHub numeric ID as text
        owner_id        TEXT,                         -- optional foreign key to gold.user_profile(user_id)
        repo_name       TEXT NOT NULL,
        description     TEXT,
        html_url        TEXT,
        visibility      TEXT,                         -- e.g. 'public' | 'private' | 'internal'
        default_branch  TEXT,
        fork_count      INTEGER,
        last_activity   TIMESTAMPTZ,
        created_at      TIMESTAMPTZ,
        fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_repository_owner_id ON gold.repository (owner_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_repository_name ON gold.repository (repo_name)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_repository_last_activity ON gold.repository (last_activity DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS gold.repository`);
  }
}
