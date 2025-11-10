import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserProfile1755614062187 implements MigrationInterface {
  //name = AddUserProfile1755614062187;
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS gold.user_profile (
      user_id         TEXT PRIMARY KEY,
      login           TEXT UNIQUE NOT NULL,
      name            TEXT,
      avatar_url      TEXT,
      html_url        TEXT,
      email           TEXT,
      company         TEXT,
      location        TEXT,
      bio             TEXT,
      blog            TEXT,
      twitter_username TEXT,
      public_repos    INTEGER,
      followers       INTEGER,
      following       INTEGER,
      type            TEXT,
      site_admin      BOOLEAN,
      gh_created_at   TIMESTAMPTZ,
      gh_updated_at   TIMESTAMPTZ,
      fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS ix_user_profile_login ON gold.user_profile (login)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS gold.user_profile');
  }
}
