import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AssistantRequestStatus {
  PENDING = 'pending',
  CONTACTED = 'contacted',
  CLOSED = 'closed',
}

// The paid plans advertised on the assistance-service landing page. Null means
// the visitor submitted the form without picking one, which stays valid — the
// enquiry is worth more than the plan attached to it.
export enum AssistantRequestPlan {
  THREE_MONTHS = 'three_months',
  SIX_MONTHS = 'six_months',
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
    enum: AssistantRequestPlan,
    nullable: true,
  })
  plan: AssistantRequestPlan | null;

  @Column({
    type: 'enum',
    enum: AssistantRequestStatus,
    default: AssistantRequestStatus.PENDING,
  })
  status: AssistantRequestStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
