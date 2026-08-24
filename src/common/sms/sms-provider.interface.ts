export const SMS_PROVIDER = 'SMS_PROVIDER';

export interface SmsProvider {
  /** `purpose` is a free-form label (e.g. "otp_register", "admin") recorded for SMS analytics. */
  send(phone: string, message: string, purpose?: string): Promise<void>;
}
