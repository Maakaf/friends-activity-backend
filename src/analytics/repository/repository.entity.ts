import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'gold', name: 'repository' })
export class RepositoryEntity {
  @PrimaryColumn('text', { name: 'repo_id' }) repoId: string;
  // @Column('text', { nullable: true, name: 'owner_user_id' }) ownerUserId: string | null;
  @Column('text', { nullable: true, name: 'repo_name' }) repoName: string | null;
  @Column('text', { nullable: true }) description: string | null;
  @Column('text', { nullable: true, name: 'html_url' }) htmlUrl: string | null;
  @Column('text', { nullable: true }) visibility: string | null;
  @Column('text', { nullable: true, name: 'default_branch' }) defaultBranch: string | null;
  @Column('int', { nullable: true, name: 'fork_count' }) forkCount: number | null;
  @Column('timestamptz', { nullable: true, name: 'last_activity' }) lastActivity: Date | null;
  @Column('timestamptz', { nullable: true, name: 'created_at' }) ghCreatedAt: Date | null;
  // @Column('timestamptz', { nullable: true, name: 'fetched_at' }) fetchedAt: Date | null;
}
