import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { constants, privateEncrypt, publicEncrypt, randomUUID } from 'crypto';
import {
  PaymentCallbackResult,
  PaymentGateway,
  PaymentInitResult,
} from './payment-gateway.interface';

/**
 * Nagad Merchant Checkout integration.
 * Docs: https://developer.mynagad.com (Checkout API, KMS-based sensitive-data envelope).
 */
@Injectable()
export class NagadGateway implements PaymentGateway {
  private readonly logger = new Logger('NagadGateway');

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  private get baseUrl() {
    return this.config.get<string>('NAGAD_BASE_URL')!;
  }

  private get merchantId() {
    return this.config.get<string>('NAGAD_MERCHANT_ID')!;
  }

  private sign(data: string): string {
    const privateKey = this.formatKey(
      this.config.get<string>('NAGAD_MERCHANT_PRIVATE_KEY')!,
    );
    return privateEncrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(data),
    ).toString('base64');
  }

  private encrypt(data: string): string {
    const publicKey = this.formatKey(
      this.config.get<string>('NAGAD_PG_PUBLIC_KEY')!,
    );
    return publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(data),
    ).toString('base64');
  }

  private formatKey(raw: string): string {
    // Allows storing keys as a single .env line with literal \n sequences.
    return raw.includes('BEGIN') ? raw.replace(/\\n/g, '\n') : raw;
  }

  private dateTimeStamp(): string {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  async init(params: {
    amount: number;
    orderId: string;
  }): Promise<PaymentInitResult> {
    try {
      const dateTime = this.dateTimeStamp();
      const sensitiveData = JSON.stringify({
        merchantId: this.merchantId,
        datetime: dateTime,
        orderId: params.orderId,
        challenge: randomUUID(),
      });

      const { data: initData } = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/check-out/initialize/${this.merchantId}/${params.orderId}`,
          {
            accountNumber: this.merchantId,
            dateTime,
            sensitiveData: this.encrypt(sensitiveData),
            signature: this.sign(sensitiveData),
          },
          {
            headers: {
              'X-KM-Api-Version': 'v-0.2.0',
              'X-KM-Client-Type': 'PC_WEB',
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const completeData = JSON.stringify({
        merchantId: this.merchantId,
        orderId: params.orderId,
        currencyCode: '050',
        amount: params.amount.toFixed(2),
        challenge: initData.challenge,
      });

      const { data: completeResp } = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/check-out/complete/${initData.paymentReferenceId}`,
          {
            sensitiveData: this.encrypt(completeData),
            signature: this.sign(completeData),
            merchantCallbackURL: this.config.get<string>('NAGAD_CALLBACK_URL'),
          },
          {
            headers: {
              'X-KM-Api-Version': 'v-0.2.0',
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return {
        redirectUrl: completeResp.callBackUrl,
        providerReference: initData.paymentReferenceId,
      };
    } catch (error) {
      this.logger.error('Nagad init failed', error as Error);
      throw new BadGatewayException('Unable to start Nagad checkout');
    }
  }

  async handleCallback(
    query: Record<string, string>,
  ): Promise<PaymentCallbackResult> {
    const paymentRefId = query.payment_ref_id;
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/verify/payment/${paymentRefId}`, {
          headers: { 'X-KM-Api-Version': 'v-0.2.0' },
        }),
      );

      return {
        success: data.status === 'Success',
        providerReference: paymentRefId,
        amount: Number(data.amount),
        raw: data,
      };
    } catch (error) {
      this.logger.error('Nagad verify failed', error as Error);
      return {
        success: false,
        providerReference: paymentRefId,
        amount: 0,
        raw: { error: String(error) },
      };
    }
  }
}
