import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'user_daily_contribution' })
export class AppUserDailyContributionEntity {
  @PrimaryColumn('varchar', { length: 64, name: 'user_id' })
  userId!: string;

  @PrimaryColumn('date')
  day!: Date;

  @Column('integer', { default: 0 })
  count!: number;
}
