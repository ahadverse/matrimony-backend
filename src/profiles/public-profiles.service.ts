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
  /** Home division — stored in `state` for Bangladesh profiles. */
  division?: string;
  district?: string;
  country?: string;
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
   * Deliberately unlike the swipe feed: no opposite-gender restriction, no
   * profile-completion gate and no already-swiped exclusion, because this page
   * is the shop window and has to work for a visitor with no account at all.
   * The only hard filter is the same one the feed uses — approved profiles on
   * active accounts.
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

    const qb = this.users
      .createQueryBuilder('u')
      .innerJoinAndSelect('u.profile', 'p', 'p.approvalStatus = :approved', {
        approved: ApprovalStatus.APPROVED,
      })
      .leftJoinAndSelect('p.photos', 'photo')
      .where('u.status = :active', { active: UserStatus.ACTIVE });

    if (filters.publicId) {
      // An id search is a lookup, not a filter — it identifies one profile, so
      // every other criterion is irrelevant to it.
      qb.andWhere('UPPER(p.publicId) = UPPER(:publicId)', {
        publicId: filters.publicId.trim(),
      });
    } else {
      this.applyFilters(qb, filters);
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
        photoUrl: (unlocked ? photo?.url : photo?.blurredUrl) ?? null,
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
    // `district` is kept mirrored to `city` and `state` holds the division, so
    // the sidebar's "Home Division" maps to `state` and its district filter to
    // the legacy column, which both old and new rows carry.
    if (filters.division) {
      qb.andWhere('p.state = :division', { division: filters.division });
    }
    if (filters.district) {
      qb.andWhere('(p.city = :district OR p.district = :district)', {
        district: filters.district,
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
