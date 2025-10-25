import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddUserSyncStatus1730000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension if not already enabled
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.createTable(
      new Table({
        name: 'user_sync_status',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'username',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'lastSyncAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'pending'",
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'retryCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'user_sync_status',
      new TableIndex({
        name: 'IDX_USER_SYNC_STATUS_USERNAME',
        columnNames: ['username'],
      }),
    );

    await queryRunner.createIndex(
      'user_sync_status',
      new TableIndex({
        name: 'IDX_USER_SYNC_STATUS_LAST_SYNC',
        columnNames: ['lastSyncAt'],
      }),
    );

    await queryRunner.createIndex(
      'user_sync_status',
      new TableIndex({
        name: 'IDX_USER_SYNC_STATUS_STATUS',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_sync_status');
  }
}