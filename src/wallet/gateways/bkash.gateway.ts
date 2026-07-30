import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import {
  PaymentCallbackResult,
  PaymentGateway,
  PaymentInitResult,
} from './payment-gateway.interface';

interface BkashTokenResponse {
  id_token: string;
  refresh_token: string;
  expires_in: string;
}

/**
 * bKash Tokenized Checkout (v1.2.0-beta) integration.
 * Docs: https://developer.bka.sh/docs/tokenized-checkout-url-and-request-response
 */
@Injectable()
export class BkashGateway implements PaymentGateway {
  private readonly logger = new Logger('BkashGateway');
  private cachedToken: { idToken: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  private get baseUrl() {
    return this.config.get<string>('BKASH_BASE_URL')!;
  }

  private async getIdToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.idToken;
    }

    const { data } = await firstValueFrom(
      this.http.post<BkashTokenResponse>(
        `${this.baseUrl}/tokenized/checkout/token/grant`,
        {
          app_key: this.config.get<string>('BKASH_APP_KEY'),
          app_secret: this.config.get<string>('BKASH_APP_SECRET'),
        },
        {
          headers: {
            username: this.config.get<string>('BKASH_USERNAME'),
            password: this.config.get<string>('BKASH_PASSWORD'),
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    this.cachedToken = {
      idToken: data.id_token,
      expiresAt: Date.now() + Number(data.expires_in) * 1000,
    };
    return data.id_token;
  }

  private authHeaders(idToken: string) {
    return {
      Authorization: idToken,
      'X-App-Key': this.config.get<string>('BKASH_APP_KEY'),
      'Content-Type': 'application/json',
    };
  }

  async init(params: {
    amount: number;
    orderId: string;
  }): Promise<PaymentInitResult> {
    try {
      const idToken = await this.getIdToken();
      const { data } = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/tokenized/checkout/create`,
          {
            mode: '0011',
            payerReference: params.orderId,
            callbackURL: this.config.get<string>('BKASH_CALLBACK_URL'),
            amount: params.amount.toFixed(2),
            currency: 'BDT',
            intent: 'sale',
            merchantInvoiceNumber: `BK-${randomUUID().slice(0, 12)}`,
          },
          { headers: this.authHeaders(idToken) },
        ),
      );

      return { redirectUrl: data.bkashURL, providerReference: data.paymentID };
    } catch (error) {
      this.logger.error('bKash init failed', error as Error);
      throw new BadGatewayException('Unable to start bKash checkout');
    }
  }

  async handleCallback(
    query: Record<string, string>,
  ): Promise<PaymentCallbackResult> {
    const { paymentID, status } = query;
    if (status !== 'success') {
      return {
        success: false,
        providerReference: paymentID,
        amount: 0,
        raw: query,
      };
    }

    try {
      const idToken = await this.getIdToken();
      const { data } = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/tokenized/checkout/execute`,
          { paymentID },
          { headers: this.authHeaders(idToken) },
        ),
      );

      return {
        success: data.transactionStatus === 'Completed',
        providerReference: paymentID,
        amount: Number(data.amount),
        raw: data,
      };
    } catch (error) {
      this.logger.error('bKash execute failed', error as Error);
      return {
        success: false,
        providerReference: paymentID,
        amount: 0,
        raw: { error: String(error) },
      };
    }
  }
}
