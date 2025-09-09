import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'silver', name: 'issue' })
export class IssueEntity {
  @PrimaryColumn()
  issueId: string;

  @Column()
  repoId: string;

  @Column()
  authorUserId: string;

  @Column({ nullable: true })
  assignedUserId: string;

  @Column()
  state: string;

  @Column({ type: 'timestamptz', nullable: true })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  updatedAt: Date;
}