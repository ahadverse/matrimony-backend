import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
  PaymentCallbackResult,
  PaymentGateway,
  PaymentInitResult,
} from './payment-gateway.interface';

/**
 * Stand-in used when no real bKash/Nagad merchant credentials are configured.
 * Lets the full top-up flow (checkout -> redirect -> callback -> wallet credit)
 * be exercised end-to-end locally without a live merchant account.
 */
@Injectable()
export class MockGateway implements PaymentGateway {
  private readonly logger = new Logger('MockPaymentGateway');
  private readonly pending = new Map<string, number>();

  constructor(
    private readonly providerName: 'bkash' | 'nagad',
    private readonly config: ConfigService,
  ) {}

  async init(params: {
    amount: number;
    orderId: string;
  }): Promise<PaymentInitResult> {
    const providerReference = `MOCK-${this.providerName.toUpperCase()}-${randomUUID()}`;
    this.pending.set(providerReference, params.amount);
    this.logger.warn(
      `${this.providerName} credentials not configured - using mock checkout for order ${params.orderId}`,
    );

    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const redirectUrl = `${frontendUrl}/checkout/mock?provider=${this.providerName}&ref=${providerReference}&amount=${params.amount}`;
    return { redirectUrl, providerReference };
  }

  async handleCallback(
    query: Record<string, string>,
  ): Promise<PaymentCallbackResult> {
    const providerReference = query.ref;
    const amount =
      this.pending.get(providerReference) ?? Number(query.amount ?? 0);
    this.pending.delete(providerReference);

    return {
      success: query.status !== 'failed',
      providerReference,
      amount,
      raw: query,
    };
  }
}
