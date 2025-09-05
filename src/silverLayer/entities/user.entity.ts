import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'silver', name: 'user_details' })
export class UserEntity {
  @PrimaryColumn()
  userId: string; // NVARCHAR PK

  @Column()
  login: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  htmlUrl: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  company: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  bio: string;

  @Column()
  type: string;

  @Column({ default: false })
  siteAdmin: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  ghCreatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  ghUpdatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  fetchedAt: Date;
}
