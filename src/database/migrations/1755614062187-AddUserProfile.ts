import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserProfile1755614062187 implements MigrationInterface {
//name = AddUserProfile1755614062187;
public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gold.user_profile (
        user_id         TEXT PRIMARY KEY,            -- matches bronze.actor_user_node (GitHub numeric id as text)
        node_id         TEXT UNIQUE,                 -- GitHub GraphQL node_id (optional but useful)
        login           TEXT UNIQUE NOT NULL,        -- e.g., "barlavi1"
        name            TEXT,                        -- display name
        avatar_url      TEXT,
        html_url        TEXT,
        email           TEXT,
        company         TEXT,
        location        TEXT,
        bio             TEXT,
        type            TEXT,                        -- "User" | "Organization"
        site_admin      BOOLEAN,
        gh_created_at   TIMESTAMPTZ,                 -- user.created_at (from GitHub)
        gh_updated_at   TIMESTAMPTZ,                 -- user.updated_at (from GitHub)
        fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS ix_user_profile_login
        ON gold.user_profile (login);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS gold.user_profile;
    `);
  }
}