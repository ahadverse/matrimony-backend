import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalStatus, Profile } from './entities/profile.entity';
import { Photo } from './entities/photo.entity';
import { UpsertProfileDto } from './dto/upsert-profile.dto';
import { PhotoStorageService } from '../common/storage/photo-storage.service';
import { GeoService } from '../geo/geo.service';
import { bdLocationFromDistrict } from '../common/utils/bd-location';
import { buildPublicIdCandidate } from '../common/utils/public-id';
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';
import { WalletTransactionType } from '../wallet/entities/wallet-transaction.entity';

const MAX_PHOTOS = 6;

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(Photo) private readonly photos: Repository<Photo>,
    private readonly photoStorage: PhotoStorageService,
    private readonly geoService: GeoService,
    private readonly walletService: WalletService,
    private readonly settingsService: SettingsService,
  ) {}

  async getMyProfile(userId: string): Promise<Profile | null> {
    return this.profiles.findOne({
      where: { userId },
      relations: { photos: true },
      order: { photos: { order: 'ASC' } },
    });
  }

  async upsertMyProfile(
    userId: string,
    dto: UpsertProfileDto,
  ): Promise<Profile> {
    const location = this.resolveLocation(dto);

    let profile = await this.profiles.findOne({ where: { userId } });

    if (!profile) {
      // Every other field is optional so the registration wizard can save one
      // step at a time, but a profile with no name is unusable everywhere it
      // is read, so creating one is refused.
      if (!dto.name) {
        throw new BadRequestException('A name is required to create a profile');
      }
      profile = this.profiles.create({
        userId,
        ...dto,
        ...location,
        publicId: await this.generatePublicId(),
        approvalStatus: ApprovalStatus.PENDING,
      });
    } else {
      for (const [key, value] of Object.entries({ ...dto, ...location })) {
        if (value !== undefined) {
          (profile as unknown as Record<string, unknown>)[key] = value;
        }
      }
      // Editing a previously reviewed profile sends it back to moderation so edits can't bypass approval.
      profile.approvalStatus = ApprovalStatus.PENDING;
      profile.approvedBy = null;
      profile.approvedAt = null;
      profile.rejectionReason = null;
    }

    return this.profiles.save(profile);
  }

  /**
   * Works out the location columns to write, for two kinds of client at once.
   *
   * Worldwide clients send `country`/`state`/`city`; their `district` and
   * `subDistrict` are mirrored from `state`/`city` so the admin panel and the
   * older frontends — which only know those two columns — keep displaying the
   * right place without any change to them.
   *
   * Bangladesh-only clients still send `district`/`subDistrict` alone, and are
   * validated against bd-geo.json exactly as before.
   *
   * A request that mentions no location at all leaves the columns untouched —
   * the registration wizard collects location in one step and everything else
   * in the others, so demanding it on every PUT would fail those steps.
   */
  private resolveLocation(dto: UpsertProfileDto): Partial<Profile> {
    const mentionsLocation =
      dto.country != null ||
      dto.district != null ||
      dto.state != null ||
      dto.city != null ||
      dto.zip != null;
    if (!mentionsLocation) return {};

    if (dto.country) {
      return {
        country: dto.country,
        countryCode: dto.countryCode?.toUpperCase() ?? null,
        state: dto.state ?? null,
        city: dto.city ?? null,
        zip: dto.zip ?? null,
        district: dto.state ?? null,
        subDistrict: dto.city ?? null,
      };
    }

    if (!dto.district) {
      throw new BadRequestException('A country (or a district) is required');
    }
    if (!this.geoService.isValidDistrict(dto.district)) {
      throw new BadRequestException('Invalid district');
    }
    if (
      dto.subDistrict &&
      !this.geoService.isValidUpazila(dto.district, dto.subDistrict)
    ) {
      throw new BadRequestException(
        'Invalid sub-district for the selected district',
      );
    }

    // Fill the worldwide columns in too, so a profile created by an older client
    // still reads back correctly on frontend-v3. A district maps to `city`, not
    // `state` — its division is the state — otherwise the picker would show a
    // state that isn't among its options.
    const mapped = bdLocationFromDistrict(dto.district);
    return {
      country: mapped?.country ?? 'Bangladesh',
      countryCode: 'BD',
      state: mapped?.state ?? null,
      city: mapped?.city ?? null,
      district: dto.district,
      subDistrict: dto.subDistrict ?? null,
    };
  }

  /**
   * A short, shareable identifier shown wherever the real name is withheld:
   * four letters then four digits, e.g. `CBIC5526`. Collisions are checked
   * rather than assumed away — the keyspace is only ~4.5bn and the column
   * carries a unique index that would otherwise reject the insert.
   */
  async generatePublicId(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = buildPublicIdCandidate();
      const taken = await this.profiles.exists({
        where: { publicId: candidate },
      });
      if (!taken) return candidate;
    }
    throw new Error('Could not allocate a unique profile id');
  }

  async activateSpotlight(userId: string): Promise<Profile> {
    const profile = await this.getOwnedProfileOrThrow(userId);
    const { spotlightCost, spotlightDurationHours } =
      await this.settingsService.get();

    await this.walletService.debit(
      userId,
      spotlightCost,
      WalletTransactionType.SPOTLIGHT,
    );

    profile.spotlightUntil = new Date(
      Date.now() + spotlightDurationHours * 60 * 60 * 1000,
    );
    return this.profiles.save(profile);
  }

  private async getOwnedProfileOrThrow(userId: string): Promise<Profile> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile)
      throw new NotFoundException('Create your profile before adding photos');
    return profile;
  }

  async addPhoto(userId: string, buffer: Buffer): Promise<Photo> {
    const profile = await this.getOwnedProfileOrThrow(userId);
    const existingCount = await this.photos.count({
      where: { profileId: profile.id },
    });
    if (existingCount >= MAX_PHOTOS) {
      throw new BadRequestException(
        `You can upload up to ${MAX_PHOTOS} photos`,
      );
    }

    const { url, blurredUrl } = await this.photoStorage.savePhoto(buffer);
    const photo = this.photos.create({
      profileId: profile.id,
      url,
      blurredUrl,
      isPrimary: existingCount === 0,
      order: existingCount,
    });
    return this.photos.save(photo);
  }

  async deletePhoto(
    userId: string,
    photoId: string,
  ): Promise<{ success: true }> {
    const profile = await this.getOwnedProfileOrThrow(userId);
    const photo = await this.photos.findOne({ where: { id: photoId } });
    if (!photo || photo.profileId !== profile.id) {
      throw new ForbiddenException('Photo does not belong to your profile');
    }
    await this.photos.remove(photo);
    await this.photoStorage.deletePhoto(photo.url, photo.blurredUrl);

    if (photo.isPrimary) {
      const next = await this.photos.findOne({
        where: { profileId: profile.id },
        order: { order: 'ASC' },
      });
      if (next) {
        next.isPrimary = true;
        await this.photos.save(next);
      }
    }

    return { success: true };
  }

  async setPrimaryPhoto(
    userId: string,
    photoId: string,
  ): Promise<{ success: true }> {
    const profile = await this.getOwnedProfileOrThrow(userId);
    const target = await this.photos.findOne({ where: { id: photoId } });
    if (!target || target.profileId !== profile.id) {
      throw new ForbiddenException('Photo does not belong to your profile');
    }

    await this.photos.update({ profileId: profile.id }, { isPrimary: false });
    target.isPrimary = true;
    await this.photos.save(target);

    return { success: true };
  }
}
