import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'gold', name: 'repository' })
export class RepositoryEntity {
  @PrimaryColumn('text') repoId: string;
  @Column('text', { nullable: true }) ownerUserId: string | null;
  @Column('text', { nullable: true }) repoName: string | null;
  @Column('text', { nullable: true }) visibility: string | null;
  @Column('text', { nullable: true }) defaultBranch: string | null;
  @Column('int', { nullable: true }) forkCount: number | null;
  @Column('timestamptz', { nullable: true }) lastActivity: Date | null;
  @Column('timestamptz', { nullable: true }) ghCreatedAt: Date | null;
  @Column('timestamptz', { nullable: true }) fetchedAt: Date | null;
}
