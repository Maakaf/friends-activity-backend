import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'user_sync' })
export class AppUserSyncEntity {
  @PrimaryColumn('varchar', { length: 255 })
  login!: string;

  @Column('varchar', { length: 64, nullable: true, name: 'user_id' })
  userId!: string | null;

  @Column('varchar', { length: 32 })
  status!: string;

  @Column('timestamptz', { nullable: true, name: 'last_synced_at' })
  lastSyncedAt!: Date | null;

  @Column('text', { nullable: true, name: 'last_error' })
  lastError!: string | null;

  @Column('timestamptz', { nullable: true, name: 'updated_at' })
  updatedAt!: Date | null;
}
