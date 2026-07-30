import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('profile_view_unlocks')
@Unique(['viewerId', 'targetId'])
export class ProfileViewUnlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  viewerId: string;

  @Index()
  @Column()
  targetId: string;

  @Column({ type: 'int' })
  cost: number;

  @CreateDateColumn({ type: 'timestamptz' })
  unlockedAt: Date;
}
