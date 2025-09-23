import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'gold', name: 'user_profile' })
export class UserProfileEntity {
  @PrimaryColumn('text', { name: 'user_id' })
  userId!: string;

  @Column('text', { unique: true })
  login!: string | null;

  @Column('text', { nullable: true })
  name!: string | null;

  @Column('text', { nullable: true, name: 'avatar_url' })
  avatarUrl!: string | null;

  @Column('text', { nullable: true, name: 'html_url' })
  htmlUrl!: string | null;

  @Column('text', { nullable: true })
  email!: string | null;

  @Column('text', { nullable: true })
  company!: string | null;

  @Column('text', { nullable: true })
  location!: string | null;

  @Column('text', { nullable: true })
  bio!: string | null;

  @Column('text', { nullable: true })
  blog!: string | null;

  @Column('text', { nullable: true, name: 'twitter_username' })
  twitterUsername!: string | null;

  @Column('integer', { nullable: true, name: 'public_repos' })
  publicRepos!: number | null;

  @Column('integer', { nullable: true })
  followers!: number | null;

  @Column('integer', { nullable: true })
  following!: number | null;

  @Column('text', { nullable: true })
  type!: string | null;

  @Column('boolean', { nullable: true, name: 'site_admin' })
  siteAdmin!: boolean | null;

  @Column('timestamptz', { nullable: true, name: 'gh_created_at' })
  ghCreatedAt!: Date | null;

  @Column('timestamptz', { nullable: true, name: 'gh_updated_at' })
  ghUpdatedAt!: Date | null;

  @Column('timestamptz', { default: () => 'now()', name: 'fetched_at' })
  fetchedAt!: Date;
}
