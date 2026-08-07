import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AssistantRequestStatus {
  PENDING = 'pending',
  CONTACTED = 'contacted',
  CLOSED = 'closed',
}

@Entity('assistant_requests')
export class AssistantRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  phone: string;

  @Column()
  email: string;

  @Column({ type: 'varchar', nullable: true })
  profileId: string | null;

  @Column({
    type: 'enum',
    enum: AssistantRequestStatus,
    default: AssistantRequestStatus.PENDING,
  })
  status: AssistantRequestStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
