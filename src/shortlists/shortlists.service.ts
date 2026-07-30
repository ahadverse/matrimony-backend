import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserStatus } from '../users/entities/user.entity';
import { ApprovalStatus } from '../profiles/entities/profile.entity';
import { Shortlist } from './entities/shortlist.entity';

@Injectable()
export class ShortlistsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Shortlist)
    private readonly shortlists: Repository<Shortlist>,
  ) {}

  async add(userId: string, targetId: string) {
    if (userId === targetId) {
      throw new BadRequestException('You cannot shortlist your own profile');
    }

    const target = await this.users.findOne({
      where: { id: targetId },
      relations: { profile: true },
    });
    if (
      !target ||
      target.status !== UserStatus.ACTIVE ||
      target.profile?.approvalStatus !== ApprovalStatus.APPROVED
    ) {
      throw new NotFoundException('Profile not found');
    }

    const existing = await this.shortlists.findOne({
      where: { userId, targetId },
    });
    if (existing) return { success: true };

    await this.shortlists.save(this.shortlists.create({ userId, targetId }));
    return { success: true };
  }

  async remove(userId: string, targetId: string) {
    await this.shortlists.delete({ userId, targetId });
    return { success: true };
  }

  async list(me: User) {
    const rows = await this.shortlists.find({
      where: { userId: me.id },
      order: { createdAt: 'DESC' },
    });
    if (rows.length === 0) return [];

    const targetIds = rows.map((r) => r.targetId);
    const targets = await this.users.find({
      where: { id: In(targetIds) },
      relations: { profile: { photos: true } },
    });
    const targetById = new Map(targets.map((t) => [t.id, t]));

    return rows
      .filter((row) => targetById.get(row.targetId)?.profile)
      .map((row) => {
        const target = targetById.get(row.targetId)!;
        const primaryPhoto =
          target.profile.photos.find((photo) => photo.isPrimary) ??
          target.profile.photos[0] ??
          null;

        return {
          userId: target.id,
          name: target.profile.name,
          district: target.profile.district,
          subDistrict: target.profile.subDistrict,
          photoUrl: primaryPhoto?.url ?? null,
          isVerified: target.profile.isVerified,
          shortlistedAt: row.createdAt,
        };
      });
  }
}
