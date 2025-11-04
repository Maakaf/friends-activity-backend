import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessingQueue1755618000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bronze.processing_queue (
        user_login TEXT PRIMARY KEY,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing')),
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_processing_queue_status 
      ON bronze.processing_queue (status)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS bronze.ix_processing_queue_status
    `);
    
    await queryRunner.query(`
      DROP TABLE IF EXISTS bronze.processing_queue
    `);
  }
}