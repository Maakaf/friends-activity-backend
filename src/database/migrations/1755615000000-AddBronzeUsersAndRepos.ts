import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBronzeUsersAndRepos1755615000000 implements MigrationInterface {
  name = 'AddBronzeUsersAndRepos1755615000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bronze.github_users (
        user_node     TEXT PRIMARY KEY,         -- GitHub numeric id as text
        provider      TEXT NOT NULL DEFAULT 'github',
        login         TEXT UNIQUE NOT NULL,
        name          TEXT,
        fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        raw_payload   JSONB NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_github_users_login ON bronze.github_users (login)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bronze.github_repos (
        repo_node     TEXT PRIMARY KEY,         -- GitHub numeric id as text
        provider      TEXT NOT NULL DEFAULT 'github',
        full_name     TEXT UNIQUE NOT NULL,     -- owner/name
        owner_login   TEXT,
        name          TEXT,
        is_private    BOOLEAN,
        fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        raw_payload   JSONB NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_github_repos_owner ON bronze.github_repos (owner_login)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_github_repos_name ON bronze.github_repos (name)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS bronze.github_repos`);
    await queryRunner.query(`DROP TABLE IF EXISTS bronze.github_users`);
  }
}
