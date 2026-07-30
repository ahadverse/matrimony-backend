import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Photo } from './photo.entity';

export enum MaritalStatus {
  SINGLE = 'single',
  DIVORCED = 'divorced',
  WIDOWED = 'widowed',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum BloodGroup {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-',
}

export enum Complexion {
  FAIR = 'fair',
  MEDIUM = 'medium',
  DARK = 'dark',
}

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column()
  name: string;

  @Column()
  district: string;

  @Column({ type: 'varchar', nullable: true })
  subDistrict: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', nullable: true })
  profession: string | null;

  @Column({ type: 'varchar', nullable: true })
  education: string | null;

  @Column({ type: 'varchar', nullable: true })
  religion: string | null;

  @Column({ type: 'int', nullable: true })
  heightCm: number | null;

  @Column({ type: 'enum', enum: MaritalStatus, default: MaritalStatus.SINGLE })
  maritalStatus: MaritalStatus;

  @Column({ type: 'varchar', nullable: true })
  fatherOccupation: string | null;

  @Column({ type: 'varchar', nullable: true })
  motherOccupation: string | null;

  @Column({ type: 'int', nullable: true })
  siblingsCount: number | null;

  @Column({ type: 'enum', enum: BloodGroup, nullable: true })
  bloodGroup: BloodGroup | null;

  @Column({ type: 'enum', enum: Complexion, nullable: true })
  complexion: Complexion | null;

  @Column({ type: 'int', nullable: true })
  monthlyIncome: number | null;

  @Column({ type: 'varchar', nullable: true })
  companyName: string | null;

  @Column({ type: 'text', nullable: true })
  presentAddress: string | null;

  @Column({ type: 'text', nullable: true })
  permanentAddress: string | null;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  approvalStatus: ApprovalStatus;

  @Column({ type: 'varchar', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'varchar', nullable: true })
  verifiedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  motherTongue: string | null;

  @Column({ type: 'varchar', nullable: true })
  englishComfort: string | null;

  @Column({ type: 'varchar', nullable: true })
  residencyStatus: string | null;

  @Column({ type: 'varchar', nullable: true })
  growUpIn: string | null;

  @Column({ type: 'varchar', nullable: true })
  collegeUniversity: string | null;

  @Column({ type: 'text', nullable: true })
  partnerPreferences: string | null;

  @Column({ type: 'text', nullable: true })
  hobbies: string | null;

  @Column({ type: 'varchar', nullable: true })
  familyFinancialStatus: string | null;

  @Column({ type: 'varchar', nullable: true })
  bodyType: string | null;

  @Column({ type: 'varchar', nullable: true })
  marriageTimeline: string | null;

  @Column({ type: 'int', nullable: true })
  numberOfSisters: number | null;

  @Column({ type: 'int', nullable: true })
  numberOfBrothers: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  spotlightUntil: Date | null;

  @OneToMany(() => Photo, (photo) => photo.profile, { cascade: true })
  photos: Photo[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
