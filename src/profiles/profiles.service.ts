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

    let profile = await this.profiles.findOne({ where: { userId } });

    if (!profile) {
      profile = this.profiles.create({
        userId,
        ...dto,
        approvalStatus: ApprovalStatus.PENDING,
      });
    } else {
      for (const [key, value] of Object.entries(dto)) {
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
