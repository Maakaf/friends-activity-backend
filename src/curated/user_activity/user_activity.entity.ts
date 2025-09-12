import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'gold', name: 'user_activity' })
export class UserActivityEntity {
  @PrimaryColumn('text')
  userId!: string;

  @PrimaryColumn('date')
  day!: Date;

  @PrimaryColumn('text')
  repoId!: string;

  @PrimaryColumn('text')
  activityType!: string;

  @Column('integer', { default: 0 })
  activityCount!: number;
}
