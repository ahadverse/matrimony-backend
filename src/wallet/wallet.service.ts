import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import {
  PaymentProvider,
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from './entities/wallet-transaction.entity';
import { SettingsService } from '../settings/settings.service';
import {
  BKASH_GATEWAY,
  NAGAD_GATEWAY,
} from './gateways/payment-gateway.interface';
import type { PaymentGateway } from './gateways/payment-gateway.interface';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletTransaction)
    private readonly transactions: Repository<WalletTransaction>,
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    @Inject(BKASH_GATEWAY) private readonly bkash: PaymentGateway,
    @Inject(NAGAD_GATEWAY) private readonly nagad: PaymentGateway,
  ) {}

  private gatewayFor(provider: PaymentProvider): PaymentGateway {
    return provider === PaymentProvider.BKASH ? this.bkash : this.nagad;
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

  private async credit(
    userId: string,
    amount: number,
    pendingTransactionId: string,
    provider: PaymentProvider,
    providerTransactionId: string,
    rawResponse: Record<string, any>,
  ): Promise<WalletTransaction> {
    return this.dataSource.transaction(async (manager) => {
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
    });
  }

  async initTopup(userId: string, provider: PaymentProvider, amount: number) {
    const settings = await this.settings.get();
    if (amount < settings.minTopupAmount) {
      throw new BadRequestException(
        `Minimum top-up amount is ${settings.minTopupAmount} taka`,
      );
    }

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
      provider,
      result.providerReference,
      result.raw,
    );
    return { success: true };
  }
}
