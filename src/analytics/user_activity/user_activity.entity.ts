import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'gold', name: 'user_activity' })
export class UserActivityEntity {
  @PrimaryColumn('text', { name: 'user_id' })
  userId!: string | null;

  @PrimaryColumn('date')
  day!: Date | null;

  @PrimaryColumn('text', { name: 'repo_id' })
  repoId!: string | null;

  @PrimaryColumn('text', { name: 'activity_type' })
  activityType!: string;

  @Column('integer', { default: 0, name: 'activity_count' })
  activityCount!: number;
}
