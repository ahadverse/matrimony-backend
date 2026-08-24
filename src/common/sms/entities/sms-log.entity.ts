import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum SmsLogStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity('sms_logs')
export class SmsLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  phone: string;

  @Column({ type: 'text' })
  message: string;

  /** e.g. "otp_register", "otp_login", "otp_reset", "admin". */
  @Index()
  @Column()
  purpose: string;

  /** Name of the configured SMS_PROVIDER at send time (console/reve/mimsms). */
  @Column()
  provider: string;

  @Index()
  @Column({ type: 'enum', enum: SmsLogStatus })
  status: SmsLogStatus;

  @Column({ type: 'varchar', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
