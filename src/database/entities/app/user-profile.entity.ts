import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'user_profile' })
export class AppUserProfileEntity {
  @PrimaryColumn('varchar', { length: 64, name: 'user_id' })
  userId!: string;

  @Column('varchar', { length: 255 })
  login!: string;

  @Column('varchar', { length: 255, nullable: true })
  name!: string | null;

  @Column('text', { nullable: true, name: 'avatar_url' })
  avatarUrl!: string | null;

  @Column('text', { nullable: true, name: 'html_url' })
  htmlUrl!: string | null;

  @Column('varchar', { length: 255, nullable: true })
  company!: string | null;

  @Column('varchar', { length: 255, nullable: true })
  location!: string | null;

  @Column('text', { nullable: true })
  bio!: string | null;

  @Column('text', { nullable: true })
  blog!: string | null;

  @Column('varchar', { length: 255, nullable: true, name: 'twitter_username' })
  twitterUsername!: string | null;

  @Column('integer', { default: 0, name: 'public_repos' })
  publicRepos!: number;

  @Column('integer', { default: 0 })
  followers!: number;

  @Column('integer', { default: 0 })
  following!: number;

  @Column('varchar', { length: 64, nullable: true })
  type!: string | null;

  @Column('timestamptz', { nullable: true, name: 'gh_created_at' })
  ghCreatedAt!: Date | null;

  @Column('timestamptz', { nullable: true, name: 'fetched_at' })
  fetchedAt!: Date | null;
}
