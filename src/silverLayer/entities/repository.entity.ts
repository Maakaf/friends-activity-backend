import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'silver', name: 'repo_details' })
export class RepositoryEntity {
  @PrimaryColumn()
  repoId: string;

  @Column()
  ownerId: string; // FK → UserEntity

  @Column()
  repoName: string;

  @Column()
  visibility: string;

  @Column({ nullable: true })
  defaultBranch: string;

  @Column({ type: 'int', nullable: true })
  forkCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastActivity: Date;

  @Column({ type: 'timestamptz', nullable: true })
  createdAt: Date;
}
