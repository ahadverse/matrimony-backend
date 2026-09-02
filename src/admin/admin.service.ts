import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { ApprovalStatus, Profile } from '../profiles/entities/profile.entity';
import {
  Gender,
  User,
  UserRole,
  UserStatus,
} from '../users/entities/user.entity';
import {
  PaymentProvider,
  PaymentVerificationMethod,
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../wallet/entities/wallet-transaction.entity';
import { WalletService } from '../wallet/wallet.service';
import {
  IdentityVerification,
  VerificationStatus,
} from '../verification/entities/identity-verification.entity';
import {
  AssistantRequest,
  AssistantRequestStatus,
} from '../assistant-requests/entities/assistant-request.entity';
import {
  ContactMessage,
  ContactMessageStatus,
} from '../contact-messages/entities/contact-message.entity';
import { SettingsService } from '../settings/settings.service';
import { SMS_PROVIDER } from '../common/sms/sms-provider.interface';
import type { SmsProvider } from '../common/sms/sms-provider.interface';
import { SmsLog, SmsLogStatus } from '../common/sms/entities/sms-log.entity';
import { RejectProfileDto } from './dto/reject-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SendSmsDto } from './dto/send-sms.dto';
import { AdjustWalletDto } from './dto/adjust-wallet.dto';
import { RejectVerificationDto } from './dto/reject-verification.dto';
import { RejectManualTopupDto } from './dto/reject-manual-topup.dto';
import { SupportService } from '../support/support.service';

type SortOrder = 'ASC' | 'DESC';

function normalizeSortOrder(
  order: string | undefined,
  fallback: SortOrder,
): SortOrder {
  return order === 'ASC' || order === 'DESC' ? order : fallback;
}

/** Turns a bare `YYYY-MM-DD` into the last instant of that day so "to" date filters are inclusive. */
function endOfDay(date: string): string {
  return date.length === 10 ? `${date}T23:59:59.999` : date;
}

interface ListPendingProfilesParams {
  page: number;
  pageSize: number;
  gender?: Gender;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListUsersParams {
  page: number;
  pageSize: number;
  status?: UserStatus;
  gender?: Gender;
  verified?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListVerificationSubmissionsParams {
  page: number;
  pageSize: number;
  status?: VerificationStatus;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListAssistantRequestsParams {
  page: number;
  pageSize: number;
  status?: AssistantRequestStatus;
  search?: string;
}

interface ListContactMessagesParams {
  page: number;
  pageSize: number;
  status?: ContactMessageStatus;
  search?: string;
}

interface ListSmsLogsParams {
  page: number;
  pageSize: number;
  status?: SmsLogStatus;
  purpose?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ListTransactionsParams {
  page: number;
  pageSize: number;
  userId?: string;
  type?: WalletTransactionType;
  status?: WalletTransactionStatus;
  search?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: string;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(WalletTransaction)
    private readonly transactions: Repository<WalletTransaction>,
    @InjectRepository(IdentityVerification)
    private readonly verifications: Repository<IdentityVerification>,
    @InjectRepository(AssistantRequest)
    private readonly assistantRequests: Repository<AssistantRequest>,
    @InjectRepository(ContactMessage)
    private readonly contactMessages: Repository<ContactMessage>,
    @InjectRepository(SmsLog)
    private readonly smsLogs: Repository<SmsLog>,
    private readonly settings: SettingsService,
    private readonly dataSource: DataSource,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    private readonly walletService: WalletService,
    private readonly supportService: SupportService,
  ) {}

  async listPendingProfiles(params: ListPendingProfilesParams) {
    const { page, pageSize, gender, search, sortBy, sortOrder } = params;

    const qb = this.profiles
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.photos', 'photos')
      .leftJoinAndSelect('profile.user', 'user')
      .where('profile.approvalStatus = :status', {
        status: ApprovalStatus.PENDING,
      });

    if (gender) qb.andWhere('user.gender = :gender', { gender });
    if (search) {
      qb.andWhere(
        '(profile.name ILIKE :search OR profile.publicId ILIKE :search OR user.phone ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const sortColumns: Record<string, string> = {
      createdAt: 'profile.createdAt',
      name: 'profile.name',
    };
    qb.orderBy(
      sortColumns[sortBy ?? ''] ?? 'profile.createdAt',
      normalizeSortOrder(sortOrder, 'ASC'),
    );
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
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

  async listUsers(params: ListUsersParams) {
    const {
      page,
      pageSize,
      status,
      gender,
      verified,
      search,
      sortBy,
      sortOrder,
    } = params;

    const qb = this.users
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.profile', 'profile');

    if (status) qb.andWhere('u.status = :status', { status });
    if (gender) qb.andWhere('u.gender = :gender', { gender });
    if (verified !== undefined) {
      qb.andWhere('profile.isVerified = :verified', { verified });
    }
    if (search) {
      qb.andWhere('(u.phone ILIKE :search OR profile.name ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const sortColumns: Record<string, string> = {
      createdAt: 'u.createdAt',
      walletBalance: 'u.walletBalance',
      phone: 'u.phone',
      lastActiveAt: 'u.lastActiveAt',
      name: 'profile.name',
    };
    qb.orderBy(
      sortColumns[sortBy ?? ''] ?? 'u.createdAt',
      normalizeSortOrder(sortOrder, 'DESC'),
    );
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async getUserDetail(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const profile = await this.profiles.findOne({
      where: { userId },
      relations: { photos: true },
    });

    const verification = await this.verifications.findOne({
      where: { userId },
    });

    const recentTransactions = await this.transactions.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return { user, profile, verification, recentTransactions };
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

  async listVerificationSubmissions(params: ListVerificationSubmissionsParams) {
    const { page, pageSize, status, search, sortBy, sortOrder } = params;

    // Manual (unmanaged) joins on purpose: IdentityVerification.userId has no
    // @ManyToOne relation, so these joins are query-time only and never make
    // TypeORM's synchronize touch the identity_verifications schema.
    // identity_verifications.userId is a varchar column (no FK relation was ever
    // declared on it), while users.id is uuid — Postgres won't compare the two
    // without an explicit cast. Alias is "acct", not "user" — `user` is a
    // reserved word in Postgres and broke quoting in this hand-written join.
    const qb = this.verifications
      .createQueryBuilder('v')
      .leftJoin(User, 'acct', 'acct.id::text = v.userId')
      .leftJoin(Profile, 'profile', 'profile.userId = acct.id')
      .addSelect([
        'acct.id',
        'acct.phone',
        'profile.name',
        'profile.isVerified',
      ]);

    if (status) qb.andWhere('v.status = :status', { status });
    if (search) {
      qb.andWhere(
        '(acct.phone ILIKE :search OR profile.name ILIKE :search OR v.nidNumber ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const sortColumns: Record<string, string> = {
      createdAt: 'v.createdAt',
      reviewedAt: 'v.reviewedAt',
    };
    qb.orderBy(
      sortColumns[sortBy ?? ''] ?? 'v.createdAt',
      normalizeSortOrder(sortOrder, 'ASC'),
    );
    qb.skip((page - 1) * pageSize).take(pageSize);

    const { entities, raw } = await qb.getRawAndEntities();

    return {
      items: entities.map((submission, i) => ({
        ...submission,
        user: raw[i].acct_id
          ? {
              id: raw[i].acct_id as string,
              phone: raw[i].acct_phone as string,
              name: (raw[i].profile_name as string | null) ?? null,
              isVerified: Boolean(raw[i].profile_isVerified),
            }
          : null,
      })),
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

  async listTransactions(params: ListTransactionsParams) {
    const {
      page,
      pageSize,
      userId,
      type,
      status,
      search,
      from,
      to,
      sortBy,
      sortOrder,
    } = params;

    // Manual (unmanaged) joins on purpose: WalletTransaction.userId has no
    // @ManyToOne relation, so these joins are query-time only and never make
    // TypeORM's synchronize touch the wallet_transactions schema.
    // wallet_transactions.userId is a varchar column (no FK relation was ever
    // declared on it), while users.id is uuid — Postgres won't compare the two
    // without an explicit cast. Alias is "acct", not "user" — `user` is a
    // reserved word in Postgres and broke quoting in this hand-written join.
    const qb = this.transactions
      .createQueryBuilder('t')
      .leftJoin(User, 'acct', 'acct.id::text = t.userId')
      .leftJoin(Profile, 'profile', 'profile.userId = acct.id')
      .addSelect(['acct.id', 'acct.phone', 'profile.name']);

    if (userId) qb.andWhere('t.userId = :userId', { userId });
    if (type) qb.andWhere('t.type = :type', { type });
    if (status) qb.andWhere('t.status = :status', { status });
    if (search) {
      qb.andWhere('(acct.phone ILIKE :search OR profile.name ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (from) qb.andWhere('t.createdAt >= :from', { from });
    if (to) qb.andWhere('t.createdAt <= :to', { to: endOfDay(to) });

    const total = await qb.getCount();

    const sortColumns: Record<string, string> = {
      createdAt: 't.createdAt',
      amount: 't.amount',
    };
    qb.orderBy(
      sortColumns[sortBy ?? ''] ?? 't.createdAt',
      normalizeSortOrder(sortOrder, 'DESC'),
    );
    qb.skip((page - 1) * pageSize).take(pageSize);

    const { entities, raw } = await qb.getRawAndEntities();

    return {
      items: entities.map((t, i) => ({
        ...t,
        user: raw[i].acct_id
          ? {
              id: raw[i].acct_id as string,
              phone: raw[i].acct_phone as string,
              name: (raw[i].profile_name as string | null) ?? null,
            }
          : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async listPendingManualTopups(page = 1, pageSize = 20) {
    // Manual (unmanaged) join, same reasoning as listTransactions above:
    // wallet_transactions.userId has no @ManyToOne relation.
    const qb = this.transactions
      .createQueryBuilder('t')
      .leftJoin(User, 'acct', 'acct.id::text = t.userId')
      .leftJoin(Profile, 'profile', 'profile.userId = acct.id')
      .addSelect(['acct.id', 'acct.phone', 'profile.name'])
      .where('t.status = :status', { status: WalletTransactionStatus.PENDING })
      .andWhere('t.provider = :provider', { provider: PaymentProvider.BKASH })
      .andWhere('t.verificationMethod = :method', {
        method: PaymentVerificationMethod.MANUAL,
      })
      .orderBy('t.createdAt', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const total = await qb.getCount();
    const { entities, raw } = await qb.getRawAndEntities();

    return {
      items: entities.map((t, i) => ({
        ...t,
        user: raw[i].acct_id
          ? {
              id: raw[i].acct_id as string,
              phone: raw[i].acct_phone as string,
              name: (raw[i].profile_name as string | null) ?? null,
            }
          : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  approveManualTopup(adminId: string, id: string) {
    return this.walletService.approveManualTopup(id, adminId);
  }

  rejectManualTopup(adminId: string, id: string, dto: RejectManualTopupDto) {
    return this.walletService.rejectManualTopup(id, adminId, dto.reason);
  }

  getSettings() {
    return this.settings.get();
  }

  updateSettings(dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }

  async sendSms(dto: SendSmsDto) {
    await this.sms.send(dto.phone, dto.message, 'admin');
    return { success: true };
  }

  async listSmsLogs(params: ListSmsLogsParams) {
    const { page, pageSize, status, purpose, search, sortBy, sortOrder } =
      params;

    const qb = this.smsLogs.createQueryBuilder('s');

    if (status) qb.andWhere('s.status = :status', { status });
    if (purpose) qb.andWhere('s.purpose = :purpose', { purpose });
    if (search) qb.andWhere('s.phone ILIKE :search', { search: `%${search}%` });

    const sortColumns: Record<string, string> = {
      createdAt: 's.createdAt',
      phone: 's.phone',
    };
    qb.orderBy(
      sortColumns[sortBy ?? ''] ?? 's.createdAt',
      normalizeSortOrder(sortOrder, 'DESC'),
    );
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async getSmsStats() {
    const since = new Date();
    since.setDate(since.getDate() - 13);
    since.setHours(0, 0, 0, 0);

    const [totalSent, successCount, failedCount, byPurposeRaw, byDayRaw] =
      await Promise.all([
        this.smsLogs.count(),
        this.smsLogs.count({ where: { status: SmsLogStatus.SUCCESS } }),
        this.smsLogs.count({ where: { status: SmsLogStatus.FAILED } }),
        this.smsLogs
          .createQueryBuilder('s')
          .select('s.purpose', 'purpose')
          .addSelect('COUNT(*)', 'count')
          .groupBy('s.purpose')
          .getRawMany<{ purpose: string; count: string }>(),
        this.smsLogs
          .createQueryBuilder('s')
          .select('DATE(s.createdAt)', 'day')
          .addSelect('s.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .where('s.createdAt >= :since', { since })
          .groupBy('DATE(s.createdAt)')
          .addGroupBy('s.status')
          .orderBy('DATE(s.createdAt)', 'ASC')
          .getRawMany<{ day: string; status: SmsLogStatus; count: string }>(),
      ]);

    const byDayMap = new Map<
      string,
      { day: string; success: number; failed: number }
    >();
    for (const row of byDayRaw) {
      const day = new Date(row.day).toISOString().slice(0, 10);
      const entry = byDayMap.get(day) ?? { day, success: 0, failed: 0 };
      if (row.status === SmsLogStatus.SUCCESS)
        entry.success += Number(row.count);
      else entry.failed += Number(row.count);
      byDayMap.set(day, entry);
    }

    return {
      totalSent,
      successCount,
      failedCount,
      byPurpose: byPurposeRaw.map((row) => ({
        purpose: row.purpose,
        count: Number(row.count),
      })),
      byDay: Array.from(byDayMap.values()).sort((a, b) =>
        a.day.localeCompare(b.day),
      ),
    };
  }

  async listAssistantRequests(params: ListAssistantRequestsParams) {
    const { page, pageSize, status, search } = params;

    const qb = this.assistantRequests.createQueryBuilder('r');

    if (status) qb.andWhere('r.status = :status', { status });
    if (search) {
      qb.andWhere(
        '(r.name ILIKE :search OR r.phone ILIKE :search OR r.email ILIKE :search)',
        {
          search: `%${search}%`,
        },
      );
    }

    qb.orderBy('r.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async updateAssistantRequestStatus(
    id: string,
    status: AssistantRequestStatus,
  ) {
    const request = await this.assistantRequests.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Assistant request not found');
    request.status = status;
    return this.assistantRequests.save(request);
  }

  async listContactMessages(params: ListContactMessagesParams) {
    const { page, pageSize, status, search } = params;

    const qb = this.contactMessages.createQueryBuilder('m');

    if (status) qb.andWhere('m.status = :status', { status });
    if (search) {
      qb.andWhere(
        '(m.name ILIKE :search OR m.phone ILIKE :search OR m.email ILIKE :search OR m.subject ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('m.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async updateContactMessageStatus(id: string, status: ContactMessageStatus) {
    const message = await this.contactMessages.findOne({ where: { id } });
    if (!message) throw new NotFoundException('Contact message not found');
    message.status = status;
    return this.contactMessages.save(message);
  }

  listSupportConversations() {
    return this.supportService.listConversationsForAdmin();
  }

  async getSupportThread(userId: string) {
    const thread = await this.supportService.listThread(userId);
    await this.supportService.markReadByAdmin(userId);
    return thread;
  }

  replyToSupport(adminId: string, userId: string, body: string) {
    return this.supportService.createAdminMessage(adminId, userId, body);
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
