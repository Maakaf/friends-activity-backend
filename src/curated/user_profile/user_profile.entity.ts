import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'gold', name: 'user_profile' })
export class UserProfileEntity {
  @PrimaryColumn('text')
  userId!: string;

  @Column('text', { unique: true })
  login!: string | null;

  @Column('text', { nullable: true })
  name!: string | null;

  @Column('text', { nullable: true })
  avatarUrl!: string | null;

  @Column('text', { nullable: true })
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
  type!: string | null;

  @Column('boolean', { nullable: true })
  siteAdmin!: boolean | null;

  @Column('timestamptz', { nullable: true })
  ghCreatedAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  ghUpdatedAt!: Date | null;

  @Column('timestamptz', { default: () => 'now()' })
  fetchedAt!: Date;
}
