import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGraphqlPipelineTables1755900000000
  implements MigrationInterface
{
  name = 'CreateGraphqlPipelineTables1755900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_profile (
        user_id          VARCHAR(64) PRIMARY KEY,
        login            VARCHAR(255) NOT NULL,
        name             VARCHAR(255),
        avatar_url       TEXT,
        html_url         TEXT,
        company          VARCHAR(255),
        location         VARCHAR(255),
        bio              TEXT,
        blog             TEXT,
        twitter_username VARCHAR(255),
        public_repos     INTEGER DEFAULT 0,
        followers        INTEGER DEFAULT 0,
        following        INTEGER DEFAULT 0,
        type             VARCHAR(64),
        gh_created_at    TIMESTAMPTZ,
        fetched_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_profile_login ON user_profile (login)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS repository (
        repo_id                VARCHAR(64) PRIMARY KEY,
        repo_name              VARCHAR(512) NOT NULL,
        description            TEXT,
        html_url               TEXT,
        fork_count             INTEGER DEFAULT 0,
        stargazer_count        INTEGER DEFAULT 0,
        primary_language       VARCHAR(255),
        primary_language_color VARCHAR(32),
        license_name           VARCHAR(255),
        license_spdx           VARCHAR(64),
        topics                 TEXT[]
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_repository_name ON repository (repo_name)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_repository_fork_count ON repository (fork_count) WHERE fork_count >= 3`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_activity (
        user_id        VARCHAR(64) NOT NULL,
        day            DATE NOT NULL,
        repo_id        VARCHAR(64) NOT NULL,
        activity_type  VARCHAR(32) NOT NULL,
        activity_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, day, repo_id, activity_type)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_activity_repo ON user_activity (repo_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_activity_day ON user_activity (day)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_sync (
        login          VARCHAR(255) PRIMARY KEY,
        user_id        VARCHAR(64),
        status         VARCHAR(32) NOT NULL,
        last_synced_at TIMESTAMPTZ,
        last_error     TEXT,
        updated_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_sync_status ON user_sync (status)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_daily_contribution (
        user_id VARCHAR(64) NOT NULL,
        day     DATE NOT NULL,
        count   INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, day)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_daily_contribution_day ON user_daily_contribution (day)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_daily_contribution`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_sync`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_activity`);
    await queryRunner.query(`DROP TABLE IF EXISTS repository`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_profile`);
  }
}
