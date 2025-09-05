import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'silver', name: 'comment' })
export class CommentEntity {
  @PrimaryColumn()
  commentId: string;

  @Column()
  parentId: string; // Issue or PR

  @Column()
  parentType: string; // 'Issue' | 'PR'

  @Column()
  authorUserId: string;

  @Column({ type: 'timestamptz', nullable: true })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  updatedAt: Date;

  @Column({ type: 'text', nullable: true })
  body: string;
}