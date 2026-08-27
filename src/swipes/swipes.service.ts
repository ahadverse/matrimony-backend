import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, Gender, UserStatus } from '../users/entities/user.entity';
import { ApprovalStatus } from '../profiles/entities/profile.entity';
import { Swipe, SwipeAction } from './entities/swipe.entity';
import { ProfileViewUnlock } from '../profile-view/entities/profile-view-unlock.entity';
import { CreateSwipeDto } from './dto/create-swipe.dto';
import { haversineDistanceKm } from '../common/utils/haversine';
import { calculateAge, getDobBoundsForAgeRange } from '../common/utils/age';
import {
  calculateProfileCompletion,
  MIN_BROWSE_COMPLETION_PERCENT,
} from '../common/utils/profile-completion';
import { publicLocationFields } from '../common/utils/location-fields';
import { debugLog } from '../common/utils/debug-log';
import { MatchesService } from '../matches/matches.service';
import { ConversationsService } from '../chat/services/conversations.service';
import { ProfilesService } from '../profiles/profiles.service';

const BROWSE_CANDIDATE_POOL = 300;
const DEFAULT_BROWSE_LIMIT = 20;

export interface BrowseFeedOptions {
  country?: string;
  state?: string;
  city?: string;
  /** Legacy Bangladesh-only filters, still sent by the older frontends. */
  district?: string;
  subDistrict?: string;
  education?: string;
  profession?: string;
  religion?: string;
  maritalStatus?: string;
  ageMin?: number;
  ageMax?: number;
  /** v1's `limit` param — only used when `page`/`pageSize` are both absent. */
  legacyLimit?: number;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class SwipesService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Swipe) private readonly swipes: Repository<Swipe>,
    @InjectRepository(ProfileViewUnlock)
    private readonly unlocks: Repository<ProfileViewUnlock>,
    private readonly matchesService: MatchesService,
    private readonly conversationsService: ConversationsService,
    private readonly profilesService: ProfilesService,
  ) {}

  async getBrowseFeed(me: User | undefined, options: BrowseFeedOptions = {}) {
    const {
      country,
      state,
      city,
      district,
      subDistrict,
      education,
      profession,
      religion,
      maritalStatus,
      ageMin,
      ageMax,
      legacyLimit,
    } = options;
    // v1 (the swipe-deck frontend) calls this endpoint without page/pageSize
    // and expects a bare array back — only paginate when v2's grid Browse
    // page explicitly asks for it, so the response contract stays
    // backward-compatible for existing callers.
    const paginated =
      options.page !== undefined || options.pageSize !== undefined;
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? DEFAULT_BROWSE_LIMIT;

    // A guest (me undefined) has no profile to gate on and no swipe history
    // to exclude — they get an unpersonalized, ungendered preview of the
    // deck. All of the checks and exclusions below only apply once someone
    // is actually signed in.
    let oppositeGender: Gender | undefined;
    let excludedIds: string[] = [];

    if (me) {
      const myProfile = await this.profilesService.getMyProfile(me.id);
      const { percent, missingFields } = calculateProfileCompletion(myProfile);
      if (percent < MIN_BROWSE_COMPLETION_PERCENT) {
        throw new ForbiddenException({
          message: `Complete at least ${MIN_BROWSE_COMPLETION_PERCENT}% of your profile to browse other members`,
          code: 'PROFILE_INCOMPLETE',
          completionPercent: percent,
          missingFields,
        });
      }

      // The feed is defined as "the opposite gender", so it has nothing to show
      // until the wizard's Basic Info step has recorded one. Reported as an
      // incomplete profile because that is what it is, and the frontend already
      // routes that code to the profile form.
      if (!me.gender) {
        throw new ForbiddenException({
          message: 'Add your gender to your profile to browse other members',
          code: 'PROFILE_INCOMPLETE',
          completionPercent: percent,
          missingFields: [...missingFields, 'gender'],
        });
      }
      oppositeGender = me.gender === Gender.MALE ? Gender.FEMALE : Gender.MALE;

      const alreadySwiped = await this.swipes.find({
        where: { swiperId: me.id },
        select: ['targetId'],
      });
      excludedIds = [me.id, ...alreadySwiped.map((s) => s.targetId)];
    }

    const qb = this.users
      .createQueryBuilder('u')
      .innerJoinAndSelect('u.profile', 'p', 'p.approvalStatus = :approved', {
        approved: ApprovalStatus.APPROVED,
      })
      .leftJoinAndSelect('p.photos', 'photo')
      .where('u.status = :active', { active: UserStatus.ACTIVE })
      .take(BROWSE_CANDIDATE_POOL);

    if (oppositeGender) {
      qb.andWhere('u.gender = :oppositeGender', { oppositeGender });
    }
    if (excludedIds.length > 0) {
      qb.andWhere('u.id NOT IN (:...excludedIds)', { excludedIds });
    }
    if (country) {
      qb.andWhere('p.country = :country', { country });
    }
    if (state) {
      qb.andWhere('p.state = :state', { state });
    }
    if (city) {
      qb.andWhere('p.city = :city', { city });
    }
    if (district) {
      qb.andWhere('p.district = :district', { district });
    }
    if (subDistrict) {
      qb.andWhere('p.subDistrict = :subDistrict', { subDistrict });
    }
    if (education) {
      qb.andWhere('p.education = :education', { education });
    }
    if (profession) {
      qb.andWhere('p.profession = :profession', { profession });
    }
    if (religion) {
      qb.andWhere('p.religion = :religion', { religion });
    }
    if (maritalStatus) {
      qb.andWhere('p.maritalStatus = :maritalStatus', { maritalStatus });
    }
    const { minDob, maxDob } = getDobBoundsForAgeRange(ageMin, ageMax);
    if (minDob) {
      qb.andWhere('u.dob >= :minDob', { minDob });
    }
    if (maxDob) {
      qb.andWhere('u.dob <= :maxDob', { maxDob });
    }

    const candidates = await qb.getMany();
    const now = Date.now();

    const withDistance = candidates.map((candidate) => {
      const primaryPhoto =
        candidate.profile.photos.find((photo) => photo.isPrimary) ??
        candidate.profile.photos[0] ??
        null;
      const distanceKm =
        me?.latitude != null &&
        me?.longitude != null &&
        candidate.latitude != null &&
        candidate.longitude != null
          ? haversineDistanceKm(
              me.latitude,
              me.longitude,
              candidate.latitude,
              candidate.longitude,
            )
          : null;
      const isSpotlighted =
        candidate.profile.spotlightUntil != null &&
        candidate.profile.spotlightUntil.getTime() > now;

      return {
        id: candidate.id,
        name: candidate.profile.name,
        age: calculateAge(candidate.dob),
        ...publicLocationFields(candidate.profile),
        profession: candidate.profile.profession,
        education: candidate.profile.education,
        religion: candidate.profile.religion,
        maritalStatus: candidate.profile.maritalStatus,
        photoUrl: primaryPhoto?.url ?? null,
        distanceKm,
        isVerified: candidate.profile.isVerified,
        isSpotlighted,
      };
    });

    withDistance.sort((a, b) => {
      if (a.isSpotlighted !== b.isSpotlighted) {
        return a.isSpotlighted ? -1 : 1;
      }
      return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    });

    if (!paginated) {
      // Legacy shape: a bare array, sliced by `legacyLimit` (v1 behavior).
      return withDistance.slice(0, legacyLimit ?? DEFAULT_BROWSE_LIMIT);
    }

    const total = withDistance.length;
    const start = (page - 1) * pageSize;
    const items = withDistance.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  }

  async createSwipe(me: User, dto: CreateSwipeDto) {
    if (dto.targetId === me.id) {
      throw new BadRequestException('You cannot swipe your own profile');
    }

    const target = await this.users.findOne({
      where: { id: dto.targetId },
      relations: { profile: true },
    });
    if (
      !target ||
      target.status !== UserStatus.ACTIVE ||
      target.profile?.approvalStatus !== ApprovalStatus.APPROVED
    ) {
      throw new NotFoundException('Profile not found');
    }

    const existing = await this.swipes.findOne({
      where: { swiperId: me.id, targetId: dto.targetId },
    });
    if (existing) {
      throw new ConflictException('You have already swiped on this profile');
    }

    const swipe = this.swipes.create({
      swiperId: me.id,
      targetId: dto.targetId,
      action: dto.action,
    });
    await this.swipes.save(swipe);

    if (
      dto.action === SwipeAction.LIKE ||
      dto.action === SwipeAction.SUPERLIKE
    ) {
      const reciprocal = await this.swipes.findOne({
        where: {
          swiperId: dto.targetId,
          targetId: me.id,
          action: In([SwipeAction.LIKE, SwipeAction.SUPERLIKE]),
        },
      });

      if (reciprocal) {
        const match = await this.matchesService.createMatchIfNotExists(
          me.id,
          dto.targetId,
        );
        const conversation =
          await this.conversationsService.getOrCreateForMatch(match);
        return {
          success: true,
          matched: true,
          conversationId: conversation.id,
        };
      }
    }

    return { success: true, matched: false };
  }

  async getLikesYou(me: User) {
    const incoming = await this.swipes.find({
      where: {
        targetId: me.id,
        action: In([SwipeAction.LIKE, SwipeAction.SUPERLIKE]),
      },
      order: { createdAt: 'DESC' },
    });
    debugLog(
      `getLikesYou userId=${me.id} incomingSwipes=${incoming.length} swiperIds=${JSON.stringify(incoming.map((s) => s.swiperId))}`,
    );
    if (incoming.length === 0) return [];

    const swiperIds = incoming.map((s) => s.swiperId);
    const swipers = await this.users.find({
      where: { id: In(swiperIds) },
      relations: { profile: { photos: true } },
    });
    const unlocks = await this.unlocks.find({
      where: { viewerId: me.id, targetId: In(swiperIds) },
    });
    const unlockedIds = new Set(unlocks.map((u) => u.targetId));

    const swiperById = new Map(swipers.map((s) => [s.id, s]));
    const droppedForMissingProfile = incoming.filter(
      (swipe) => !swiperById.get(swipe.swiperId)?.profile,
    );
    if (droppedForMissingProfile.length > 0) {
      debugLog(
        `getLikesYou userId=${me.id} dropping ${droppedForMissingProfile.length} swipe(s) from users with no profile row: ${JSON.stringify(droppedForMissingProfile.map((s) => s.swiperId))}`,
      );
    }

    return incoming
      .filter((swipe) => swiperById.get(swipe.swiperId)?.profile)
      .map((swipe) => {
        const swiper = swiperById.get(swipe.swiperId)!;
        const isUnlocked = unlockedIds.has(swiper.id);
        const primaryPhoto =
          swiper.profile.photos.find((photo) => photo.isPrimary) ??
          swiper.profile.photos[0] ??
          null;

        return {
          userId: swiper.id,
          name: swiper.profile.name,
          ...publicLocationFields(swiper.profile),
          superliked: swipe.action === SwipeAction.SUPERLIKE,
          unlocked: isUnlocked,
          photoUrl: isUnlocked
            ? (primaryPhoto?.url ?? null)
            : (primaryPhoto?.blurredUrl ?? null),
          likedAt: swipe.createdAt,
          isVerified: swiper.profile.isVerified,
        };
      });
  }

  async getMyLikes(me: User) {
    const outgoing = await this.swipes.find({
      where: {
        swiperId: me.id,
        action: In([SwipeAction.LIKE, SwipeAction.SUPERLIKE]),
      },
      order: { createdAt: 'DESC' },
    });
    if (outgoing.length === 0) return [];

    const targetIds = outgoing.map((s) => s.targetId);
    const targets = await this.users.find({
      where: { id: In(targetIds) },
      relations: { profile: { photos: true } },
    });
    const targetById = new Map(targets.map((t) => [t.id, t]));

    return outgoing
      .filter((swipe) => targetById.get(swipe.targetId)?.profile)
      .map((swipe) => {
        const target = targetById.get(swipe.targetId)!;
        const distanceKm =
          me.latitude != null &&
          me.longitude != null &&
          target.latitude != null &&
          target.longitude != null
            ? haversineDistanceKm(
                me.latitude,
                me.longitude,
                target.latitude,
                target.longitude,
              )
            : null;
        const primaryPhoto =
          target.profile.photos.find((photo) => photo.isPrimary) ??
          target.profile.photos[0] ??
          null;

        return {
          userId: target.id,
          name: target.profile.name,
          ...publicLocationFields(target.profile),
          distanceKm,
          photoUrl: primaryPhoto?.url ?? null,
          superliked: swipe.action === SwipeAction.SUPERLIKE,
          likedAt: swipe.createdAt,
          isVerified: target.profile.isVerified,
        };
      });
  }

  async getFiltered(me: User) {
    const rejected = await this.swipes.find({
      where: { swiperId: me.id, action: SwipeAction.REJECT },
      order: { createdAt: 'DESC' },
    });
    if (rejected.length === 0) return [];

    const targetIds = rejected.map((s) => s.targetId);
    const targets = await this.users.find({
      where: { id: In(targetIds) },
      relations: { profile: { photos: true } },
    });
    const targetById = new Map(targets.map((t) => [t.id, t]));

    return rejected
      .filter((swipe) => targetById.get(swipe.targetId)?.profile)
      .map((swipe) => {
        const target = targetById.get(swipe.targetId)!;
        const primaryPhoto =
          target.profile.photos.find((photo) => photo.isPrimary) ??
          target.profile.photos[0] ??
          null;

        return {
          userId: target.id,
          name: target.profile.name,
          ...publicLocationFields(target.profile),
          photoUrl: primaryPhoto?.url ?? null,
          isVerified: target.profile.isVerified,
          filteredAt: swipe.createdAt,
        };
      });
  }
}
