import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessingStatusToUsers1736334000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bronze.github_users 
      ADD COLUMN processing_status TEXT DEFAULT 'ready' 
      CHECK (processing_status IN ('ready', 'processing', 'failed'))
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_github_users_status 
      ON bronze.github_users (processing_status)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS bronze.ix_github_users_status
    `);
    
    await queryRunner.query(`
      ALTER TABLE bronze.github_users 
      DROP COLUMN IF EXISTS processing_status
    `);
  }
}