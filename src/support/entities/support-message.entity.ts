import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum SupportSenderRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('support_messages')
export class SupportMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The customer this thread belongs to — every admin reply is addressed to
  // this id too, regardless of which admin sent it, so a thread is just
  // "all messages with this userId" rather than a separate conversation row.
  @Index()
  @Column()
  userId: string;

  @Column()
  senderId: string;

  @Column({ type: 'enum', enum: SupportSenderRole })
  senderRole: SupportSenderRole;

  @Column({ type: 'text' })
  body: string;

  // Direction-dependent: on a USER row this means "an admin read it"; on an
  // ADMIN row this means "the user read it".
  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
