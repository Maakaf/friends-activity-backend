import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOwnerUserIdToRepository1755625000000 implements MigrationInterface {
    name = 'AddOwnerUserIdToRepository1755625000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "gold"."repository" ADD "owner_user_id" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "gold"."repository" DROP COLUMN "owner_user_id"`);
    }
}