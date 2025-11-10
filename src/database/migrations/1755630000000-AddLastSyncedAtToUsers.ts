import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastSyncedAtToUsers1755630000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bronze.github_users 
      ADD COLUMN last_synced_at TIMESTAMPTZ
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_github_users_last_synced 
      ON bronze.github_users (last_synced_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS bronze.ix_github_users_last_synced
    `);
    
    await queryRunner.query(`
      ALTER TABLE bronze.github_users 
      DROP COLUMN IF EXISTS last_synced_at
    `);
  }
}