import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Profile } from '../../profiles/entities/profile.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  BANNED = 'banned',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  phone: string;

  // Nullable: accounts created before the registration rework only ever had a
  // phone number, and phone remains the login identifier.
  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ select: false })
  passwordHash: string;

  /**
   * Nullable because the registration wizard creates the account on its first
   * screen (mobile / email / password) and only asks for gender on the next
   * one. Features that need an "opposite gender" — the swipe feed and the
   * active-members list — refuse to run until it is set.
   */
  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ type: 'date', nullable: true })
  dob: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  phoneVerifiedAt: Date | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'int', default: 0 })
  walletBalance: number;

  @Column({ default: 'en' })
  languagePref: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastActiveAt: Date | null;

  @OneToOne(() => Profile, (profile) => profile.user)
  profile: Profile;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
