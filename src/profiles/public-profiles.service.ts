import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Gender, User, UserStatus } from '../users/entities/user.entity';
import { ApprovalStatus } from './entities/profile.entity';
import { ProfileViewUnlock } from '../profile-view/entities/profile-view-unlock.entity';
import { getDobBoundsForAgeRange } from '../common/utils/age';
import {
  lockedProfileFields,
  primaryPhoto,
  unlockedProfileFields,
} from '../common/utils/profile-visibility';

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;

export interface PublicProfileFilters {
  gender?: string;
  ageMin?: number;
  ageMax?: number;
  heightMinCm?: number;
  heightMaxCm?: number;
  country?: string;
  state?: string;
  city?: string;
  education?: string;
  profession?: string;
  workingSector?: string;
  religion?: string;
  maritalStatus?: string;
  /** Exact-match lookup on the public profile id, e.g. `CBIC5526`. */
  publicId?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class PublicProfilesService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ProfileViewUnlock)
    private readonly unlocks: Repository<ProfileViewUnlock>,
  ) {}

  /**
   * The public profiles directory.
   *
   * Unlike the swipe feed there is no profile-completion gate and no
   * already-swiped exclusion, because this page is the shop window and has to
   * work for a visitor with no account at all. The hard filters are approved
   * profiles on active accounts, plus — for a signed-in viewer — the two rules
   * a matrimony directory cannot get wrong: never list the viewer's own
   * profile, and never list their own gender.
   *
   * `viewerId` is optional. When present, profiles that viewer has already paid
   * to unlock come back with their real name and unblurred photos.
   */
  async list(filters: PublicProfileFilters, viewerId?: string) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE),
    );

    const viewer = viewerId
      ? await this.users.findOne({ where: { id: viewerId } })
      : null;

    const qb = this.users
      .createQueryBuilder('u')
      .innerJoinAndSelect('u.profile', 'p', 'p.approvalStatus = :approved', {
        approved: ApprovalStatus.APPROVED,
      })
      .leftJoinAndSelect('p.photos', 'photo')
      .where('u.status = :active', { active: UserStatus.ACTIVE });

    if (viewer) {
      qb.andWhere('u.id <> :viewerId', { viewerId: viewer.id });
    }

    // An anonymous visitor has no gender to match against, so the browse-by-
    // gender filter is theirs to set. For a signed-in member the opposite
    // gender is the only sensible listing, and it overrides whatever the
    // filter (or a stale deep link) asked for.
    const oppositeGender = viewer?.gender
      ? viewer.gender === Gender.MALE
        ? Gender.FEMALE
        : Gender.MALE
      : null;
    if (oppositeGender) {
      qb.andWhere('u.gender = :oppositeGender', { oppositeGender });
    }

    if (filters.publicId) {
      // An id search is a lookup, not a filter — it identifies one profile, so
      // every other criterion is irrelevant to it. The self/gender rules above
      // still apply: they are not filters, they are what this viewer may see.
      qb.andWhere('UPPER(p.publicId) = UPPER(:publicId)', {
        publicId: filters.publicId.trim(),
      });
    } else {
      // `gender` is already pinned above for a signed-in viewer; dropping it
      // here keeps the same predicate from being appended twice.
      this.applyFilters(qb, {
        ...filters,
        gender: oppositeGender ? undefined : filters.gender,
      });
    }

    // Spotlighted profiles first, then newest — a stable ordering the pager can
    // page through, which the feed's distance sort could not provide here
    // (an anonymous visitor has no location to measure from).
    qb.orderBy('p.spotlightUntil', 'DESC', 'NULLS LAST')
      .addOrderBy('p.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [candidates, total] = await qb.getManyAndCount();

    const unlockedIds = await this.unlockedIdsFor(
      viewerId,
      candidates.map((c) => c.id),
    );

    const items = candidates.map((candidate) => {
      const unlocked = unlockedIds.has(candidate.id);
      const photo = primaryPhoto(candidate.profile);
      return {
        ...(unlocked
          ? unlockedProfileFields(candidate)
          : // The directory is the one locked view that names names — everywhere
            // else (profile preview, likes-you, interests) a still-locked row
            // withholds it, but this listing shows it up front regardless of
            // unlock state.
            {
              ...lockedProfileFields(candidate),
              name: candidate.profile.name,
            }),
        // The directory thumbnail is always the clear primary photo, locked or
        // not — it is the hook that draws a visitor in. Unlocking buys the rest
        // of the gallery plus the contact details.
        photoUrl: photo?.url ?? null,
        isSpotlighted:
          candidate.profile.spotlightUntil != null &&
          candidate.profile.spotlightUntil.getTime() > Date.now(),
      };
    });

    return { items, total, page, pageSize };
  }

  private async unlockedIdsFor(
    viewerId: string | undefined,
    targetIds: string[],
  ): Promise<Set<string>> {
    if (!viewerId || targetIds.length === 0) return new Set();
    const unlocks = await this.unlocks.find({
      where: { viewerId, targetId: In(targetIds) },
    });
    return new Set(unlocks.map((u) => u.targetId));
  }

  private applyFilters(
    qb: ReturnType<Repository<User>['createQueryBuilder']>,
    filters: PublicProfileFilters,
  ): void {
    if (filters.gender) {
      qb.andWhere('u.gender = :gender', {
        gender: filters.gender as Gender,
      });
    }
    if (filters.country) {
      qb.andWhere('p.country = :country', { country: filters.country });
    }
    if (filters.state) {
      qb.andWhere('p.state = :state', { state: filters.state });
    }
    // `district` is the pre-worldwide Bangladesh column, kept mirrored to
    // `city` — matching either lets the filter still work against older rows
    // that only ever had `district` populated.
    if (filters.city) {
      qb.andWhere('(p.city = :city OR p.district = :city)', {
        city: filters.city,
      });
    }
    if (filters.education) {
      qb.andWhere('p.education = :education', { education: filters.education });
    }
    if (filters.profession) {
      qb.andWhere('p.profession = :profession', {
        profession: filters.profession,
      });
    }
    if (filters.workingSector) {
      qb.andWhere('p.workingSector = :workingSector', {
        workingSector: filters.workingSector,
      });
    }
    if (filters.religion) {
      qb.andWhere('p.religion = :religion', { religion: filters.religion });
    }
    if (filters.maritalStatus) {
      qb.andWhere('p.maritalStatus = :maritalStatus', {
        maritalStatus: filters.maritalStatus,
      });
    }
    if (filters.heightMinCm != null) {
      qb.andWhere('p.heightCm >= :heightMinCm', {
        heightMinCm: filters.heightMinCm,
      });
    }
    if (filters.heightMaxCm != null) {
      qb.andWhere('p.heightCm <= :heightMaxCm', {
        heightMaxCm: filters.heightMaxCm,
      });
    }

    const { minDob, maxDob } = getDobBoundsForAgeRange(
      filters.ageMin,
      filters.ageMax,
    );
    if (minDob) qb.andWhere('u.dob >= :minDob', { minDob });
    if (maxDob) qb.andWhere('u.dob <= :maxDob', { maxDob });
  }
}
