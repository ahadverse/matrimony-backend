import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export enum SwipeAction {
  LIKE = 'like',
  REJECT = 'reject',
  SUPERLIKE = 'superlike',
}

@Entity('swipes')
@Unique(['swiperId', 'targetId'])
export class Swipe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  swiperId: string;

  @Index()
  @Column()
  targetId: string;

  @Column({ type: 'enum', enum: SwipeAction })
  action: SwipeAction;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
