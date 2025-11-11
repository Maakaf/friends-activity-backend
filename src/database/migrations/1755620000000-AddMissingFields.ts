import { MigrationInterface, QueryRunner } from 'typeorm';

type ExistsRow = { exists: boolean };

export class AddMissingFields1755620000000 implements MigrationInterface {
  name = 'AddMissingFields1755620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if gold.user_profile table exists before altering
    const userProfileExists = (await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'gold' AND table_name = 'user_profile'
      )
    `)) as ExistsRow[];

    if (userProfileExists[0]?.exists) {
      await queryRunner.query(`
        ALTER TABLE gold.user_profile 
        ADD COLUMN IF NOT EXISTS blog TEXT,
        ADD COLUMN IF NOT EXISTS twitter_username TEXT,
        ADD COLUMN IF NOT EXISTS public_repos INTEGER,
        ADD COLUMN IF NOT EXISTS followers INTEGER,
        ADD COLUMN IF NOT EXISTS following INTEGER
      `);
    }

    // Check if gold.repository table exists before altering
    const repositoryExists = (await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'gold' AND table_name = 'repository'
      )
    `)) as ExistsRow[];

    if (repositoryExists[0]?.exists) {
      await queryRunner.query(`
        ALTER TABLE gold.repository 
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS html_url TEXT
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if gold.user_profile table exists before altering
    const userProfileExists = (await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'gold' AND table_name = 'user_profile'
      )
    `)) as ExistsRow[];

    if (userProfileExists[0]?.exists) {
      await queryRunner.query(`
        ALTER TABLE gold.user_profile 
        DROP COLUMN IF EXISTS blog,
        DROP COLUMN IF EXISTS twitter_username,
        DROP COLUMN IF EXISTS public_repos,
        DROP COLUMN IF EXISTS followers,
        DROP COLUMN IF EXISTS following
      `);
    }

    // Check if gold.repository table exists before altering
    const repositoryExists = (await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'gold' AND table_name = 'repository'
      )
    `)) as ExistsRow[];

    if (repositoryExists[0]?.exists) {
      await queryRunner.query(`
        ALTER TABLE gold.repository 
        DROP COLUMN IF EXISTS description,
        DROP COLUMN IF EXISTS html_url
      `);
    }
  }
}
