import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRollingActivity1756000000000 implements MigrationInterface {
  name = 'AddUserRollingActivity1756000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_rolling_activity (
        user_id  VARCHAR(64) NOT NULL,
        day      DATE        NOT NULL,
        total    INTEGER     DEFAULT 0,
        PRIMARY KEY (user_id, day)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_rolling_activity_day ON user_rolling_activity (day)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_rolling_activity`);
  }
}
