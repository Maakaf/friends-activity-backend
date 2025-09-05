import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'silver', name: 'commits' })
export class CommitEntity {
  @PrimaryColumn()
  commitId: string;

  @Column()
  pushEventId: string;

  @Column()
  repoId: string; // FK → RepositoryEntity

  @Column()
  authorUserId: string; // FK → UserEntity

  @Column({ type: 'timestamptz', nullable: true })
  createdAt: Date;
}