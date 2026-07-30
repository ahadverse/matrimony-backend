import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
import { ApprovalStatus, Profile } from '../profiles/entities/profile.entity';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import {
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../wallet/entities/wallet-transaction.entity';
import {
  IdentityVerification,
  VerificationStatus,
} from '../verification/entities/identity-verification.entity';
import { SettingsService } from '../settings/settings.service';
import { SMS_PROVIDER } from '../common/sms/sms-provider.interface';
import type { SmsProvider } from '../common/sms/sms-provider.interface';
import { RejectProfileDto } from './dto/reject-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SendSmsDto } from './dto/send-sms.dto';
import { AdjustWalletDto } from './dto/adjust-wallet.dto';
import { RejectVerificationDto } from './dto/reject-verification.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(WalletTransaction)
    private readonly transactions: Repository<WalletTransaction>,
    @InjectRepository(IdentityVerification)
    private readonly verifications: Repository<IdentityVerification>,
    private readonly settings: SettingsService,
    private readonly dataSource: DataSource,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async listPendingProfiles(page = 1, pageSize = 20) {
    const [items, total] = await this.profiles.findAndCount({
      where: { approvalStatus: ApprovalStatus.PENDING },
      relations: { photos: true, user: true },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  async approveProfile(adminId: string, profileId: string) {
    const profile = await this.profiles.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Profile not found');

    profile.approvalStatus = ApprovalStatus.APPROVED;
    profile.approvedBy = adminId;
    profile.approvedAt = new Date();
    profile.rejectionReason = null;
    return this.profiles.save(profile);
  }

  async rejectProfile(
    adminId: string,
    profileId: string,
    dto: RejectProfileDto,
  ) {
    const profile = await this.profiles.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Profile not found');

    profile.approvalStatus = ApprovalStatus.REJECTED;
    profile.approvedBy = adminId;
    profile.approvedAt = new Date();
    profile.rejectionReason = dto.reason;
    return this.profiles.save(profile);
  }

  async listApprovedProfiles(page = 1, pageSize = 20, verified?: boolean) {
    const [items, total] = await this.profiles.findAndCount({
      where: {
        approvalStatus: ApprovalStatus.APPROVED,
        ...(verified !== undefined ? { isVerified: verified } : {}),
      },
      relations: { photos: true, user: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  async verifyProfile(adminId: string, profileId: string) {
    const profile = await this.profiles.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Profile not found');
    if (profile.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new BadRequestException('Only approved profiles can be verified');
    }

    profile.isVerified = true;
    profile.verifiedBy = adminId;
    profile.verifiedAt = new Date();
    return this.profiles.save(profile);
  }

  async unverifyProfile(profileId: string) {
    const profile = await this.profiles.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Profile not found');

    profile.isVerified = false;
    profile.verifiedBy = null;
    profile.verifiedAt = null;
    return this.profiles.save(profile);
  }

  async listUsers(page = 1, pageSize = 20, status?: UserStatus) {
    const [items, total] = await this.users.findAndCount({
      where: status ? { status } : {},
      relations: { profile: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  async setUserStatus(userId: string, status: UserStatus) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN)
      throw new BadRequestException('Cannot change status of an admin account');

    user.status = status;
    return this.users.save(user);
  }

  async adjustWallet(userId: string, dto: AdjustWalletDto) {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .createQueryBuilder(User, 'u')
        .setLock('pessimistic_write')
        .where('u.id = :userId', { userId })
        .getOne();
      if (!user) throw new NotFoundException('User not found');

      const balanceAfter = user.walletBalance + dto.amount;
      if (balanceAfter < 0) {
        throw new BadRequestException(
          'Adjustment would take the wallet balance below zero',
        );
      }

      user.walletBalance = balanceAfter;
      await manager.save(user);

      return manager.save(
        manager.create(WalletTransaction, {
          userId,
          type: WalletTransactionType.ADMIN_ADJUST,
          amount: dto.amount,
          balanceAfter,
          status: WalletTransactionStatus.SUCCESS,
          rawResponse: dto.reason ? { reason: dto.reason } : null,
        }),
      );
    });
  }

  async listVerificationSubmissions(
    page = 1,
    pageSize = 20,
    status?: VerificationStatus,
  ) {
    const [items, total] = await this.verifications.findAndCount({
      where: status ? { status } : {},
      order: { createdAt: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const userIds = items.map((v) => v.userId);
    const users = await this.users.find({
      where: { id: In(userIds) },
      relations: { profile: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    return {
      items: items.map((submission) => {
        const user = userById.get(submission.userId);
        return {
          ...submission,
          user: user
            ? {
                id: user.id,
                phone: user.phone,
                name: user.profile?.name ?? null,
                isVerified: user.profile?.isVerified ?? false,
              }
            : null,
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  async approveVerification(adminId: string, id: string) {
    const submission = await this.verifications.findOne({ where: { id } });
    if (!submission)
      throw new NotFoundException('Verification submission not found');

    submission.status = VerificationStatus.APPROVED;
    submission.reviewedBy = adminId;
    submission.reviewedAt = new Date();
    submission.rejectionReason = null;
    await this.verifications.save(submission);

    const profile = await this.profiles.findOne({
      where: { userId: submission.userId },
    });
    if (profile) {
      profile.isVerified = true;
      profile.verifiedBy = adminId;
      profile.verifiedAt = new Date();
      await this.profiles.save(profile);
    }

    return submission;
  }

  async rejectVerification(
    adminId: string,
    id: string,
    dto: RejectVerificationDto,
  ) {
    const submission = await this.verifications.findOne({ where: { id } });
    if (!submission)
      throw new NotFoundException('Verification submission not found');

    submission.status = VerificationStatus.REJECTED;
    submission.rejectionReason = dto.reason;
    submission.reviewedBy = adminId;
    submission.reviewedAt = new Date();
    return this.verifications.save(submission);
  }

  async listTransactions(page = 1, pageSize = 20) {
    const [items, total] = await this.transactions.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  getSettings() {
    return this.settings.get();
  }

  updateSettings(dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }

  async sendSms(dto: SendSmsDto) {
    await this.sms.send(dto.phone, dto.message);
    return { success: true };
  }

  async getStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalUsers, pendingApprovals, todaySignups, successfulTopups] =
      await Promise.all([
        this.users.count(),
        this.profiles.count({
          where: { approvalStatus: ApprovalStatus.PENDING },
        }),
        this.users.count({
          where: { createdAt: MoreThanOrEqual(startOfToday) },
        }),
        this.transactions.find({
          where: {
            type: WalletTransactionType.TOPUP,
            status: WalletTransactionStatus.SUCCESS,
          },
        }),
      ]);

    const totalRevenue = successfulTopups.reduce((sum, t) => sum + t.amount, 0);

    return { totalUsers, pendingApprovals, todaySignups, totalRevenue };
  }
}
