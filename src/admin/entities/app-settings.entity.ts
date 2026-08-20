import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('app_settings')
export class AppSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', default: 200 })
  profileViewCost: number;

  @Column({ type: 'int', default: 500 })
  minTopupAmount: number;

  @Column({ type: 'int', default: 150 })
  spotlightCost: number;

  @Column({ type: 'int', default: 24 })
  spotlightDurationHours: number;

  @Column({ type: 'varchar', default: '12,000+' })
  statVerifiedMembers: string;

  @Column({ type: 'varchar', default: '3,200+' })
  statMatchesMade: string;

  @Column({ type: 'varchar', default: '64' })
  statDistrictsCovered: string;

  @Column({ type: 'varchar', default: '4.8/5' })
  statAverageRating: string;

  @Column({ type: 'varchar', default: '100%' })
  statProfilesReviewedPercent: string;

  @Column({ type: 'varchar', nullable: true })
  whatsappNumber: string | null;

  @Column({ type: 'varchar', default: '01304082381' })
  bkashMerchantNumber: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
