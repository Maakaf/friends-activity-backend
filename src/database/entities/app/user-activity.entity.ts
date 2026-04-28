import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'user_activity' })
export class AppUserActivityEntity {
  @PrimaryColumn('varchar', { length: 64, name: 'user_id' })
  userId!: string;

  @PrimaryColumn('date')
  day!: Date;

  @PrimaryColumn('varchar', { length: 64, name: 'repo_id' })
  repoId!: string;

  @PrimaryColumn('varchar', { length: 32, name: 'activity_type' })
  activityType!: string;

  @Column('integer', { default: 0, name: 'activity_count' })
  activityCount!: number;
}
