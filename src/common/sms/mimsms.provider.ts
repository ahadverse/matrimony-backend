import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SmsProvider } from './sms-provider.interface';

interface MimSmsResponse {
  statusCode: string;
  status: string;
  trxnId: string;
  responseResult: string;
}

/**
 * MiMSMS /V2/SMS integration (https://api.mimsms.com/api).
 * Docs: https://www.mimsms.com/api-documentation (OpenAPI spec at /files/openapi.yaml).
 * Requires the calling server's IP/domain to be whitelisted in the MiMSMS panel
 * (Utility -> Developer) before requests are accepted.
 */
@Injectable()
export class MimSmsProvider implements SmsProvider {
  private readonly logger = new Logger('MimSmsProvider');

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  async send(phone: string, message: string): Promise<void> {
    const mobileNumber = phone.replace(/^\+/, '');

    try {
      const { data } = await firstValueFrom(
        this.http.post<MimSmsResponse>(
          `${this.config.get<string>('MIMSMS_BASE_URL', 'https://api.mimsms.com/api')}/V2/SMS`,
          {
            apiKey: this.config.get<string>('MIMSMS_API_KEY'),
            userName: this.config.get<string>('MIMSMS_USERNAME'),
            senderName: this.config.get<string>('MIMSMS_SENDER_NAME'),
            transactionType: 'T',
            mobileNumber,
            message,
          },
        ),
      );

      if (data.status !== 'Success') {
        this.logger.error(
          `MiMSMS rejected message to ${mobileNumber}: statusCode=${data.statusCode} responseResult=${data.responseResult}`,
        );
        throw new BadGatewayException('Unable to send SMS');
      }
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      this.logger.error('MiMSMS request failed', error as Error);
      throw new BadGatewayException('Unable to send SMS');
    }
  }
}
