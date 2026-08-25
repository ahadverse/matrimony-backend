import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum OtpPurpose {
  REGISTER = 'register',
  LOGIN = 'login',
  RESET = 'reset',
}

export enum OtpChannel {
  SMS = 'sms',
  EMAIL = 'email',
}

@Entity('otp_verifications')
export class OtpVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  phone: string;

  @Column()
  codeHash: string;

  @Column({ type: 'enum', enum: OtpPurpose })
  purpose: OtpPurpose;

  // REGISTER-purpose OTPs go by SMS for Bangladeshi phone numbers and by
  // email everywhere else (BD is the only country with an SMS gateway wired
  // up) — recorded here so verifyOtp knows which of the user's
  // phoneVerifiedAt/emailVerifiedAt to stamp once the code checks out.
  @Column({ type: 'enum', enum: OtpChannel, default: OtpChannel.SMS })
  channel: OtpChannel;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ default: false })
  consumed: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
