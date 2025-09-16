import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'gold', name: 'user_activity' })
export class UserActivityEntity {
  @PrimaryColumn('text')
  userId!: string | null;

  @PrimaryColumn('date')
  day!: Date | null;

  @PrimaryColumn('text')
  repoId!: string | null;

  @PrimaryColumn('text')
  activityType!: string;

  @Column('integer', { default: 0 })
  activityCount!: number;
}
