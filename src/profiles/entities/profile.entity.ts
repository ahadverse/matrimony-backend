import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
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

/**
 * `medium` predates the four-way scale the registration wizard now offers; it
 * is remapped to `wheatish` by `npm run backfill:public-ids` and kept in the
 * enum only so rows written before that backfill still load.
 */
export enum Complexion {
  VERY_FAIR = 'very_fair',
  FAIR = 'fair',
  WHEATISH = 'wheatish',
  MEDIUM = 'medium',
  DARK = 'dark',
}

export enum ParentStatus {
  ALIVE = 'alive',
  DECEASED = 'deceased',
}

export enum FamilyValues {
  TRADITIONAL = 'traditional',
  MODERATE = 'moderate',
  LIBERAL = 'liberal',
}

export enum Diet {
  VEGETARIAN = 'vegetarian',
  NON_VEGETARIAN = 'non_vegetarian',
  NOT_MATTER = 'not_matter',
}

export enum Smoke {
  NON_SMOKER = 'non_smoker',
  SMOKER = 'smoker',
  LIGHT_SOCIAL = 'light_social',
}

export enum ProfileCreatedBy {
  SELF = 'self',
  PARENTS = 'parents',
  BROTHER = 'brother',
  SISTER = 'sister',
  RELATIVE = 'relative',
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

  /**
   * Public-facing identifier (`CBIC5526`) shown wherever the real name must
   * stay hidden — the public profiles list and every locked profile. Nullable
   * only so rows created before it existed load; `backfill:public-ids` fills
   * them and ProfilesService assigns one to every new profile.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12, nullable: true })
  publicId: string | null;

  @Column()
  name: string;

  /**
   * `district` and `subDistrict` predate worldwide locations and are still read
   * by the admin panel and the older frontends. They are kept in sync with
   * `state`/`city` on every write (see ProfilesService.upsertMyProfile) rather
   * than being removed.
   */
  @Column({ type: 'varchar', nullable: true })
  district: string | null;

  @Column({ type: 'varchar', nullable: true })
  subDistrict: string | null;

  @Column({ type: 'varchar', nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  countryCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  state: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', nullable: true })
  zip: string | null;

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

  @Column({ type: 'enum', enum: ProfileCreatedBy, nullable: true })
  profileCreatedBy: ProfileCreatedBy | null;

  /** Name of the parent/sibling/relative running the profile, when not `self`. */
  @Column({ type: 'varchar', nullable: true })
  relativeName: string | null;

  /** Contact number for that same relative — a match reaches the guardian, not just the member. */
  @Column({ type: 'varchar', nullable: true })
  relativePhone: string | null;

  @Column({ type: 'varchar', nullable: true })
  nationality: string | null;

  @Column({ type: 'text', nullable: true })
  educationDetails: string | null;

  @Column({ type: 'varchar', nullable: true })
  workingSector: string | null;

  @Column({ type: 'text', nullable: true })
  professionDetails: string | null;

  /** "Keep it private" on the income field — hides the amount from other members. */
  @Column({ type: 'boolean', default: false })
  incomeIsPrivate: boolean;

  @Column({ type: 'enum', enum: ParentStatus, nullable: true })
  fatherStatus: ParentStatus | null;

  @Column({ type: 'enum', enum: ParentStatus, nullable: true })
  motherStatus: ParentStatus | null;

  @Column({ type: 'varchar', nullable: true })
  fatherOccupation: string | null;

  @Column({ type: 'varchar', nullable: true })
  motherOccupation: string | null;

  @Column({ type: 'int', nullable: true })
  siblingsCount: number | null;

  @Column({ type: 'int', nullable: true })
  brothersMarried: number | null;

  @Column({ type: 'int', nullable: true })
  brothersUnmarried: number | null;

  @Column({ type: 'int', nullable: true })
  sistersMarried: number | null;

  @Column({ type: 'int', nullable: true })
  sistersUnmarried: number | null;

  @Column({ type: 'text', nullable: true })
  familyDetails: string | null;

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

  @Column({ type: 'int', nullable: true })
  numberOfSisters: number | null;

  @Column({ type: 'int', nullable: true })
  numberOfBrothers: number | null;

  @Column({ type: 'int', nullable: true })
  weightKg: number | null;

  @Column({ type: 'text', nullable: true })
  physicalDetails: string | null;

  /** Free text — "Very religious", "Average religious", "Not religious". */
  @Column({ type: 'varchar', nullable: true })
  religiousValue: string | null;

  @Column({ type: 'enum', enum: FamilyValues, nullable: true })
  familyValues: FamilyValues | null;

  @Column({ type: 'enum', enum: Diet, nullable: true })
  diet: Diet | null;

  @Column({ type: 'enum', enum: Smoke, nullable: true })
  smoke: Smoke | null;

  @Column({ type: 'timestamptz', nullable: true })
  spotlightUntil: Date | null;

  @OneToMany(() => Photo, (photo) => photo.profile, { cascade: true })
  photos: Photo[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
