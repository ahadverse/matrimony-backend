import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum ContactMessageStatus {
  NEW = 'new',
  READ = 'read',
  REPLIED = 'replied',
}

@Entity('contact_messages')
export class ContactMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  /** Optional on the contact form — email is the required reply channel. */
  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column()
  email: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'enum',
    enum: ContactMessageStatus,
    default: ContactMessageStatus.NEW,
  })
  status: ContactMessageStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
