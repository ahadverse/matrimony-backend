import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockedUser } from './entities/blocked-user.entity';

export interface BlockStatus {
  blockedByMe: boolean;
  blockedByOther: boolean;
}

@Injectable()
export class BlocksService {
  constructor(
    @InjectRepository(BlockedUser)
    private readonly blocks: Repository<BlockedUser>,
  ) {}

  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }
    const existing = await this.blocks.findOne({
      where: { blockerId, blockedId },
    });
    if (existing) return;
    await this.blocks.save(this.blocks.create({ blockerId, blockedId }));
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.blocks.delete({ blockerId, blockedId });
  }

  async getStatus(userId: string, otherUserId: string): Promise<BlockStatus> {
    const [blockedByMe, blockedByOther] = await Promise.all([
      this.blocks.exists({
        where: { blockerId: userId, blockedId: otherUserId },
      }),
      this.blocks.exists({
        where: { blockerId: otherUserId, blockedId: userId },
      }),
    ]);
    return { blockedByMe, blockedByOther };
  }

  async isBlockedEitherWay(userAId: string, userBId: string): Promise<boolean> {
    const { blockedByMe, blockedByOther } = await this.getStatus(
      userAId,
      userBId,
    );
    return blockedByMe || blockedByOther;
  }

  /** IDs of users that `userId` has blocked. */
  async listBlockedUserIds(userId: string): Promise<string[]> {
    const rows = await this.blocks.find({ where: { blockerId: userId } });
    return rows.map((row) => row.blockedId);
  }

  /** IDs of users who have blocked `userId`. */
  async listBlockerIds(userId: string): Promise<string[]> {
    const rows = await this.blocks.find({ where: { blockedId: userId } });
    return rows.map((row) => row.blockerId);
  }
}
