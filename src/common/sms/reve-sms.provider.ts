import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SmsProvider } from './sms-provider.interface';

interface ReveSendTextResponse {
  Status: string;
  Text: string;
  Message_ID?: string;
}

/**
 * REVE SMS /sendtext integration (https://smpp.revesms.com).
 * Docs: "REVE SMS API Docs. with Response Code" PDF supplied by the client.
 */
@Injectable()
export class ReveSmsProvider implements SmsProvider {
  private readonly logger = new Logger('ReveSmsProvider');

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  async send(phone: string, message: string): Promise<void> {
    const toUser = phone.replace(/^\+/, '');

    try {
      const { data } = await firstValueFrom(
        this.http.post<ReveSendTextResponse>(
          `${this.config.get<string>('REVE_BASE_URL')}/sendtext`,
          {
            apikey: this.config.get<string>('REVE_API_KEY'),
            secretkey: this.config.get<string>('REVE_SECRET_KEY'),
            callerID: this.config.get<string>('REVE_CALLER_ID'),
            toUser,
            messageContent: message,
          },
        ),
      );

      if (data.Status !== '0') {
        this.logger.error(
          `REVE SMS rejected message to ${toUser}: Status=${data.Status} Text=${data.Text}`,
        );
        throw new BadGatewayException('Unable to send SMS');
      }
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      this.logger.error('REVE SMS request failed', error as Error);
      throw new BadGatewayException('Unable to send SMS');
    }
  }
}
