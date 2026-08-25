export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';

export interface EmailProvider {
  /** `purpose` is a free-form label (e.g. "otp_register") for future analytics parity with SmsProvider. */
  send(to: string, subject: string, body: string, purpose?: string): Promise<void>;
}
