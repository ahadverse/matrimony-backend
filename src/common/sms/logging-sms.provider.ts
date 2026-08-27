import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { SmsProvider } from './sms-provider.interface';
import { SmsLog, SmsLogStatus } from './entities/sms-log.entity';

/** Masks digit runs of 4+ so OTP codes never end up readable in the analytics log. */
function redactCodes(message: string): string {
  return message.replace(/\d{4,}/g, '••••••');
}

/**
 * Wraps whichever real SmsProvider is configured (console/reve/mimsms) so every
 * send attempt is recorded for the admin SMS analytics dashboard, regardless of
 * which gateway is active.
 */
@Injectable()
export class LoggingSmsProvider implements SmsProvider {
  private readonly logger = new Logger('LoggingSmsProvider');

  constructor(
    private readonly inner: SmsProvider,
    private readonly providerName: string,
    private readonly smsLogs: Repository<SmsLog>,
  ) {}

  async send(
    phone: string,
    message: string,
    purpose = 'general',
  ): Promise<void> {
    const loggedMessage = purpose.startsWith('otp')
      ? redactCodes(message)
      : message;

    try {
      await this.inner.send(phone, message, purpose);
      await this.record(
        phone,
        loggedMessage,
        purpose,
        SmsLogStatus.SUCCESS,
        null,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.record(
        phone,
        loggedMessage,
        purpose,
        SmsLogStatus.FAILED,
        errorMessage,
      );
      throw error;
    }
  }

  private async record(
    phone: string,
    message: string,
    purpose: string,
    status: SmsLogStatus,
    errorMessage: string | null,
  ): Promise<void> {
    try {
      await this.smsLogs.save(
        this.smsLogs.create({
          phone,
          message,
          purpose,
          provider: this.providerName,
          status,
          errorMessage,
        }),
      );
    } catch (error) {
      this.logger.error('Failed to write SMS log entry', error as Error);
    }
  }
}
