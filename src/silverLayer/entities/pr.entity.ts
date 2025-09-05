import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'silver', name: 'pr' })
export class PullRequestEntity {
  @PrimaryColumn()
  prId: string;

  @Column()
  repoId: string;

  @Column()
  authorUserId: string;

  @Column({ type: 'timestamptz', nullable: true })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  mergedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  updatedAt: Date;
}