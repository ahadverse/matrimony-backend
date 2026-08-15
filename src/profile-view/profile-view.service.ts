import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Profile } from '../profiles/entities/profile.entity';
import { ProfileViewUnlock } from './entities/profile-view-unlock.entity';
import {
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../wallet/entities/wallet-transaction.entity';
import { SettingsService } from '../settings/settings.service';
import { MatchesService } from '../matches/matches.service';
import { ConversationsService } from '../chat/services/conversations.service';
import { publicLocationFields } from '../common/utils/location-fields';
import {
  lockedProfileFields,
  primaryPhoto,
  unlockedProfileFields,
  type ProfileBearingUser,
} from '../common/utils/profile-visibility';
import { debugLog } from '../common/utils/debug-log';

@Injectable()
export class ProfileViewService {
  constructor(
    @InjectRepository(ProfileViewUnlock)
    private readonly unlocks: Repository<ProfileViewUnlock>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly matchesService: MatchesService,
    private readonly conversationsService: ConversationsService,
  ) {}

  private toDetail(target: ProfileBearingUser) {
    return unlockedProfileFields(target);
  }

  async getMyProfileViews(userId: string) {
    const views = await this.unlocks.find({
      where: { targetId: userId },
      order: { unlockedAt: 'DESC' },
    });
    if (views.length === 0) return { count: 0, viewers: [] };

    const viewerIds = views.map((v) => v.viewerId);
    const viewers = await this.dataSource.getRepository(User).find({
      where: { id: In(viewerIds) },
      relations: { profile: { photos: true } },
    });
    const viewerById = new Map(viewers.map((v) => [v.id, v]));

    const list = views
      .filter((view) => viewerById.get(view.viewerId)?.profile)
      .map((view) => {
        const viewer = viewerById.get(view.viewerId)!;
        return {
          userId: viewer.id,
          name: viewer.profile.name,
          ...publicLocationFields(viewer.profile),
          photoUrl: primaryPhoto(viewer.profile)?.url ?? null,
          viewedAt: view.unlockedAt,
        };
      });

    return { count: views.length, viewers: list };
  }

  // Unlike getDetail, this has no unlock check: it backs the paywall teaser,
  // so it needs to work for exactly the profiles that aren't unlocked yet.
  // It returns the full locked payload — the whole bio-data minus name, phone,
  // email, street address and home district — because the teaser is what a
  // member judges the match on before paying.
  async getPreview(targetId: string) {
    const target = await this.dataSource.getRepository(User).findOne({
      where: { id: targetId },
      relations: { profile: { photos: true } },
    });
    if (!target) throw new NotFoundException('Profile not found');

    return {
      ...lockedProfileFields(target),
      photoUrl: primaryPhoto(target.profile)?.blurredUrl ?? null,
    };
  }

  // Paying to unlock a profile is the only gate messaging needs — this has
  // nothing to do with swipes/likes, so it skips that system entirely instead
  // of faking a "like" to back into a match.
  async startConversation(viewerId: string, targetId: string) {
    const unlocked = await this.unlocks.findOne({
      where: { viewerId, targetId },
    });
    if (!unlocked) {
      throw new ForbiddenException('Unlock this profile before messaging');
    }

    const match = await this.matchesService.createMatchIfNotExists(
      viewerId,
      targetId,
    );
    const conversation =
      await this.conversationsService.getOrCreateForMatch(match);
    return { conversationId: conversation.id };
  }

  async getDetail(viewerId: string, targetId: string) {
    const unlocked = await this.unlocks.findOne({
      where: { viewerId, targetId },
    });
    if (!unlocked) {
      throw new ForbiddenException(
        'Unlock this profile before viewing full details',
      );
    }

    const target = await this.dataSource.getRepository(User).findOne({
      where: { id: targetId },
      relations: { profile: { photos: true } },
    });
    if (!target) throw new NotFoundException('Profile not found');

    return this.toDetail(target);
  }

  async unlock(viewerId: string, targetId: string) {
    debugLog(`unlock requested viewerId=${viewerId} targetId=${targetId}`);
    const existing = await this.unlocks.findOne({
      where: { viewerId, targetId },
    });
    const target = await this.dataSource.getRepository(User).findOne({
      where: { id: targetId },
      relations: { profile: { photos: true } },
    });
    if (!target) throw new NotFoundException('Profile not found');

    if (existing) {
      debugLog(
        `unlock already existed viewerId=${viewerId} targetId=${targetId}`,
      );
      return this.toDetail(target);
    }

    // Any profile can be unlocked, not just those that liked the viewer first:
    // the wallet charge is the only gate, so a browsed or shortlisted profile
    // is as unlockable as a received interest.
    debugLog(
      `unlock creating record viewerId=${viewerId} targetId=${targetId}`,
    );

    const { profileViewCost: cost } = await this.settings.get();

    await this.dataSource.transaction(async (manager) => {
      const viewer = await manager
        .createQueryBuilder(User, 'u')
        .setLock('pessimistic_write')
        .where('u.id = :viewerId', { viewerId })
        .getOneOrFail();

      if (viewer.walletBalance < cost) {
        throw new BadRequestException('INSUFFICIENT_BALANCE');
      }

      viewer.walletBalance -= cost;
      await manager.save(viewer);

      await manager.save(
        manager.create(WalletTransaction, {
          userId: viewerId,
          type: WalletTransactionType.VIEW_UNLOCK,
          amount: -cost,
          balanceAfter: viewer.walletBalance,
          status: WalletTransactionStatus.SUCCESS,
        }),
      );

      await manager.save(
        manager.create(ProfileViewUnlock, { viewerId, targetId, cost }),
      );
    });

    return this.toDetail(target);
  }
}
