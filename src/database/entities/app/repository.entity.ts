import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'repository' })
export class AppRepositoryEntity {
  @PrimaryColumn('varchar', { length: 64, name: 'repo_id' })
  repoId!: string;

  @Column('varchar', { length: 512, name: 'repo_name' })
  repoName!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Column('text', { nullable: true, name: 'html_url' })
  htmlUrl!: string | null;

  @Column('integer', { default: 0, name: 'fork_count' })
  forkCount!: number;

  @Column('integer', { default: 0, name: 'stargazer_count' })
  stargazerCount!: number;

  @Column('varchar', { length: 255, nullable: true, name: 'primary_language' })
  primaryLanguage!: string | null;

  @Column('varchar', {
    length: 32,
    nullable: true,
    name: 'primary_language_color',
  })
  primaryLanguageColor!: string | null;

  @Column('varchar', { length: 255, nullable: true, name: 'license_name' })
  licenseName!: string | null;

  @Column('varchar', { length: 64, nullable: true, name: 'license_spdx' })
  licenseSpdx!: string | null;

  @Column('text', { array: true, nullable: true })
  topics!: string[] | null;
}
