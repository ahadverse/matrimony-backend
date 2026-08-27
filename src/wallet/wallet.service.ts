import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import {
  PaymentProvider,
  PaymentVerificationMethod,
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from './entities/wallet-transaction.entity';
import { SettingsService } from '../settings/settings.service';
import { NAGAD_GATEWAY } from './gateways/payment-gateway.interface';
import type { PaymentGateway } from './gateways/payment-gateway.interface';
import { AdminNotificationsGateway } from '../notifications/admin-notifications.gateway';
import { SubmitManualBkashDto } from './dto/submit-manual-bkash.dto';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class WalletService {
  private readonly logger = new Logger('WalletService');

  constructor(
    @InjectRepository(WalletTransaction)
    private readonly transactions: Repository<WalletTransaction>,
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    @Inject(NAGAD_GATEWAY) private readonly nagad: PaymentGateway,
    private readonly adminNotifications: AdminNotificationsGateway,
    private readonly chatGateway: ChatGateway,
  ) {}

  /** Nagad is the only provider left with an automated gateway — bKash top-ups are manual-only (submitManualBkashTopup). */
  private gatewayFor(provider: PaymentProvider): PaymentGateway {
    if (provider !== PaymentProvider.NAGAD) {
      throw new BadRequestException(
        `No automated gateway configured for provider: ${provider}`,
      );
    }
    return this.nagad;
  }

  async getBalance(userId: string) {
    const user = await this.dataSource
      .getRepository(User)
      .findOneOrFail({ where: { id: userId } });
    const settings = await this.settings.get();
    return {
      balance: user.walletBalance,
      profileViewCost: settings.profileViewCost,
      minTopupAmount: settings.minTopupAmount,
      spotlightCost: settings.spotlightCost,
      spotlightDurationHours: settings.spotlightDurationHours,
      bkashMerchantNumber: settings.bkashMerchantNumber,
    };
  }

  async getTransactions(
    userId: string,
    page = 1,
    pageSize = 20,
    type?: WalletTransactionType,
  ) {
    if (type && !Object.values(WalletTransactionType).includes(type)) {
      throw new BadRequestException('Invalid transaction type');
    }

    const [items, total] = await this.transactions.findAndCount({
      where: type ? { userId, type } : { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  async debit(
    userId: string,
    amount: number,
    type: WalletTransactionType,
  ): Promise<WalletTransaction> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .createQueryBuilder(User, 'u')
        .setLock('pessimistic_write')
        .where('u.id = :userId', { userId })
        .getOneOrFail();

      if (user.walletBalance < amount) {
        throw new BadRequestException('INSUFFICIENT_BALANCE');
      }

      user.walletBalance -= amount;
      await manager.save(user);

      return manager.save(
        manager.create(WalletTransaction, {
          userId,
          type,
          amount: -amount,
          balanceAfter: user.walletBalance,
          status: WalletTransactionStatus.SUCCESS,
        }),
      );
    });
  }

  private async creditWithManager(
    manager: EntityManager,
    userId: string,
    amount: number,
    pendingTransactionId: string,
    providerTransactionId: string,
    rawResponse: Record<string, any>,
  ): Promise<WalletTransaction> {
    const user = await manager
      .createQueryBuilder(User, 'u')
      .setLock('pessimistic_write')
      .where('u.id = :userId', { userId })
      .getOneOrFail();

    user.walletBalance += amount;
    await manager.save(user);

    await manager.update(WalletTransaction, pendingTransactionId, {
      status: WalletTransactionStatus.SUCCESS,
      balanceAfter: user.walletBalance,
      providerTransactionId,
      rawResponse,
    });

    return manager.findOneOrFail(WalletTransaction, {
      where: { id: pendingTransactionId },
    });
  }

  private async credit(
    userId: string,
    amount: number,
    pendingTransactionId: string,
    providerTransactionId: string,
    rawResponse: Record<string, any>,
  ): Promise<WalletTransaction> {
    const result = await this.dataSource.transaction((manager) =>
      this.creditWithManager(
        manager,
        userId,
        amount,
        pendingTransactionId,
        providerTransactionId,
        rawResponse,
      ),
    );
    this.notifyTopupApproved(userId, amount, result.balanceAfter);
    return result;
  }

  /** Only called once the crediting transaction has committed, so the user never hears about money that didn't actually land. */
  private notifyTopupApproved(userId: string, amount: number, balance: number) {
    try {
      this.chatGateway.notifyUser(userId, 'wallet:topup-approved', {
        amount,
        balance,
      });
    } catch (error) {
      this.logger.error('Failed to notify user of topup approval', error as Error);
    }
  }

  private async assertMinTopup(amount: number) {
    const settings = await this.settings.get();
    if (amount < settings.minTopupAmount) {
      throw new BadRequestException(
        `Minimum top-up amount is ${settings.minTopupAmount} taka`,
      );
    }
  }

  async initTopup(userId: string, provider: PaymentProvider, amount: number) {
    await this.assertMinTopup(amount);

    const pending = await this.transactions.save(
      this.transactions.create({
        userId,
        type: WalletTransactionType.TOPUP,
        amount,
        balanceAfter: 0,
        provider,
        status: WalletTransactionStatus.PENDING,
      }),
    );

    const { redirectUrl, providerReference } = await this.gatewayFor(
      provider,
    ).init({
      amount,
      orderId: pending.id,
    });

    await this.transactions.update(pending.id, {
      providerTransactionId: providerReference,
    });

    return { redirectUrl };
  }

  async handleCallback(
    provider: PaymentProvider,
    query: Record<string, string>,
  ) {
    const gateway = this.gatewayFor(provider);
    const result = await gateway.handleCallback(query);

    const pending = await this.transactions.findOne({
      where: {
        providerTransactionId: result.providerReference,
        provider,
        status: WalletTransactionStatus.PENDING,
      },
    });

    if (!pending) {
      return { success: false };
    }

    if (!result.success) {
      await this.transactions.update(pending.id, {
        status: WalletTransactionStatus.FAILED,
        rawResponse: result.raw,
      });
      return { success: false };
    }

    await this.credit(
      pending.userId,
      pending.amount,
      pending.id,
      result.providerReference,
      result.raw,
    );
    return { success: true };
  }

  async submitManualBkashTopup(userId: string, dto: SubmitManualBkashDto) {
    await this.assertMinTopup(dto.amount);

    const existing = await this.transactions.findOne({
      where: { providerTransactionId: dto.trxId },
    });
    if (existing) {
      throw new BadRequestException(
        'This transaction ID has already been submitted',
      );
    }

    const pending = await this.transactions.save(
      this.transactions.create({
        userId,
        type: WalletTransactionType.TOPUP,
        amount: dto.amount,
        balanceAfter: 0,
        provider: PaymentProvider.BKASH,
        verificationMethod: PaymentVerificationMethod.MANUAL,
        providerTransactionId: dto.trxId,
        payerAccountNumber: dto.payerAccountNumber,
        status: WalletTransactionStatus.PENDING,
      }),
    );

    try {
      const user = await this.dataSource
        .getRepository(User)
        .findOne({ where: { id: userId }, relations: { profile: true } });
      this.adminNotifications.notifyManualTopupSubmitted({
        id: pending.id,
        amount: pending.amount,
        trxId: pending.providerTransactionId,
        payerAccountNumber: pending.payerAccountNumber,
        submittedAt: pending.createdAt,
        user: {
          id: userId,
          phone: user?.phone ?? '',
          name: user?.profile?.name ?? null,
        },
      });
    } catch (error) {
      this.logger.error('Failed to push admin notification', error as Error);
    }

    return { id: pending.id, status: pending.status };
  }

  /**
   * Locks the transaction row for the whole approve/reject call so two concurrent
   * requests for the same id (e.g. an admin double-clicking Approve) can't both
   * pass the PENDING check before either has written back a final status.
   */
  private async lockPendingManualTopup(
    manager: EntityManager,
    transactionId: string,
  ): Promise<WalletTransaction> {
    const pending = await manager
      .createQueryBuilder(WalletTransaction, 't')
      .setLock('pessimistic_write')
      .where('t.id = :id', { id: transactionId })
      .getOne();
    if (!pending) throw new NotFoundException('Transaction not found');
    if (
      pending.status !== WalletTransactionStatus.PENDING ||
      pending.verificationMethod !== PaymentVerificationMethod.MANUAL
    ) {
      throw new BadRequestException(
        'Only pending manually-submitted transactions can be reviewed',
      );
    }
    return pending;
  }

  async approveManualTopup(transactionId: string, adminId: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const pending = await this.lockPendingManualTopup(manager, transactionId);
      return this.creditWithManager(
        manager,
        pending.userId,
        pending.amount,
        pending.id,
        pending.providerTransactionId as string,
        { approvedBy: adminId, method: 'manual' },
      );
    });
    this.notifyTopupApproved(result.userId, result.amount, result.balanceAfter);
    return result;
  }

  async rejectManualTopup(
    transactionId: string,
    adminId: string,
    reason: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const pending = await this.lockPendingManualTopup(manager, transactionId);

      const rawResponse: Record<string, any> = { rejectedBy: adminId, reason };
      await manager.update(WalletTransaction, pending.id, {
        status: WalletTransactionStatus.FAILED,
        rawResponse,
      });
      return manager.findOneOrFail(WalletTransaction, {
        where: { id: pending.id },
      });
    });
  }
}
