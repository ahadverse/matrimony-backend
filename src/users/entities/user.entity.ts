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

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nullable: registration now starts from email/password or a social login,
  // and phone is only collected (and verified) on the wizard's last step —
  // so an account can exist for a while with no phone at all.
  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  // Nullable at the schema level for old rows, but required by every current
  // signup path (local register, Google, Facebook) — it's now the primary
  // login identifier.
  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  // Nullable: accounts created via Google/Facebook have no password.
  @Column({ type: 'varchar', nullable: true, select: false })
  passwordHash: string | null;

  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.LOCAL })
  authProvider: AuthProvider;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  googleId: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  facebookId: string | null;

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

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

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
