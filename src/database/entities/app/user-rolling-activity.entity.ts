import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'user_rolling_activity' })
export class AppUserRollingActivityEntity {
  @PrimaryColumn('varchar', { length: 64, name: 'user_id' })
  userId!: string;

  @PrimaryColumn('date')
  day!: Date;

  @Column('integer', { default: 0 })
  total!: number;
}
