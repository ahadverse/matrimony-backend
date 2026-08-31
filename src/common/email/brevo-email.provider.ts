import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { EmailProvider } from './email-provider.interface';

/**
 * Brevo (formerly Sendinblue) transactional email API.
 * Docs: https://developers.brevo.com/reference/sendtransacemail
 */
@Injectable()
export class BrevoEmailProvider implements EmailProvider {
  private readonly logger = new Logger('BrevoEmailProvider');

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  async send(to: string, subject: string, body: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          'https://api.brevo.com/v3/smtp/email',
          {
            sender: {
              email: this.config.get<string>('BREVO_SENDER_EMAIL'),
              name: this.config.get<string>(
                'BREVO_SENDER_NAME',
                'Biye Kora Lagbe',
              ),
            },
            to: [{ email: to }],
            subject,
            htmlContent: `<p>${body}</p>`,
          },
          {
            headers: {
              'api-key': this.config.get<string>('BREVO_API_KEY'),
              'content-type': 'application/json',
            },
          },
        ),
      );
    } catch (error) {
      this.logger.error(`Brevo request failed for ${to}`, error as Error);
      throw new BadGatewayException('Unable to send email');
    }
  }
}
