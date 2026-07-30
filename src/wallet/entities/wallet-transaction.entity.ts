import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum WalletTransactionType {
  TOPUP = 'topup',
  VIEW_UNLOCK = 'view_unlock',
  REFUND = 'refund',
  ADMIN_ADJUST = 'admin_adjust',
  SPOTLIGHT = 'spotlight',
}

export enum WalletTransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export enum PaymentProvider {
  BKASH = 'bkash',
  NAGAD = 'nagad',
}

@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Column({ type: 'enum', enum: WalletTransactionType })
  type: WalletTransactionType;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'int' })
  balanceAfter: number;

  @Column({ type: 'enum', enum: PaymentProvider, nullable: true })
  provider: PaymentProvider | null;

  @Column({ type: 'varchar', nullable: true })
  providerTransactionId: string | null;

  @Column({
    type: 'enum',
    enum: WalletTransactionStatus,
    default: WalletTransactionStatus.PENDING,
  })
  status: WalletTransactionStatus;

  @Column({ type: 'jsonb', nullable: true })
  rawResponse: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
