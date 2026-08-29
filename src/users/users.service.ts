import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Gender, User, UserStatus } from './entities/user.entity';
import { ApprovalStatus } from '../profiles/entities/profile.entity';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { UpdateBasicsDto } from './dto/update-basics.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { calculateAge } from '../common/utils/age';
import { publicLocationFields } from '../common/utils/location-fields';

const ACTIVE_WINDOW_MINUTES = 15;
const ACTIVE_USERS_LIMIT = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateLocation(userId: string, dto: UpdateLocationDto) {
    await this.users.update(userId, {
      latitude: dto.latitude,
      longitude: dto.longitude,
    });
    return { success: true };
  }

  async updateLanguage(userId: string, dto: UpdateLanguageDto) {
    await this.users.update(userId, { languagePref: dto.languagePref });
    return { success: true };
  }

  async updateBasics(userId: string, dto: UpdateBasicsDto) {
    const update: Partial<Pick<User, 'gender' | 'dob'>> = {};
    if (dto.gender !== undefined) update.gender = dto.gender;
    if (dto.dob !== undefined) update.dob = dto.dob;
    await this.users.update(userId, update);
    return { success: true };
  }

  /**
   * Records a phone number against the account without verifying it.
   *
   * The uniqueness check is the same one `sendContactVerificationOtp` runs, so
   * two accounts still cannot claim one number while the OTP step is off.
   * `phoneVerifiedAt` is deliberately left alone — an unverified number must
   * not read as a verified one once SMS is switched back on.
   */
  async updatePhone(userId: string, dto: UpdatePhoneDto) {
    const taken = await this.users.findOne({
      where: { phone: dto.phone, id: Not(userId) },
    });
    if (taken) {
      throw new ConflictException(
        'An account with this phone number already exists',
      );
    }
    await this.users.update(userId, { phone: dto.phone });
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .getOneOrFail();
    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account signed in with Google/Facebook and has no password to change',
      );
    }
    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches)
      throw new BadRequestException('Current password is incorrect');

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.users.save(user);
    return { success: true };
  }

  async getActiveUsers(me: User) {
    // Nothing to list until the wizard's Basic Info step records a gender —
    // an empty list is the honest answer, and this only backs a dashboard
    // widget, so it degrades quietly rather than throwing.
    if (!me.gender) return [];

    const oppositeGender =
      me.gender === Gender.MALE ? Gender.FEMALE : Gender.MALE;
    const since = new Date(Date.now() - ACTIVE_WINDOW_MINUTES * 60_000);

    const candidates = await this.users.find({
      where: {
        gender: oppositeGender,
        status: UserStatus.ACTIVE,
        lastActiveAt: MoreThan(since),
      },
      relations: { profile: true },
      order: { lastActiveAt: 'DESC' },
      take: ACTIVE_USERS_LIMIT,
    });

    return candidates
      .filter(
        (u) =>
          u.id !== me.id &&
          u.profile?.approvalStatus === ApprovalStatus.APPROVED,
      )
      .map((u) => ({
        userId: u.id,
        name: u.profile.name,
        age: calculateAge(u.dob),
        ...publicLocationFields(u.profile),
        lastActiveAt: u.lastActiveAt,
      }));
  }
}
