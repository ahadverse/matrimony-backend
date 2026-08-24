import { Repository } from 'typeorm';
import { LoggingSmsProvider } from './logging-sms.provider';
import { SmsProvider } from './sms-provider.interface';
import { SmsLog, SmsLogStatus } from './entities/sms-log.entity';

function makeSmsLogsRepo() {
  return {
    create: jest.fn((data) => data),
    save: jest.fn().mockResolvedValue(undefined),
  } as unknown as Repository<SmsLog>;
}

describe('LoggingSmsProvider', () => {
  it('delegates to the inner provider and logs a success entry', async () => {
    const inner: SmsProvider = { send: jest.fn().mockResolvedValue(undefined) };
    const smsLogs = makeSmsLogsRepo();
    const provider = new LoggingSmsProvider(inner, 'reve', smsLogs);

    await provider.send('+8801712345678', 'Your code is 123456', 'otp_login');

    expect(inner.send).toHaveBeenCalledWith('+8801712345678', 'Your code is 123456', 'otp_login');
    expect(smsLogs.save).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '+8801712345678',
        message: 'Your code is ••••••',
        purpose: 'otp_login',
        provider: 'reve',
        status: SmsLogStatus.SUCCESS,
        errorMessage: null,
      }),
    );
  });

  it('does not redact non-otp purposes', async () => {
    const inner: SmsProvider = { send: jest.fn().mockResolvedValue(undefined) };
    const smsLogs = makeSmsLogsRepo();
    const provider = new LoggingSmsProvider(inner, 'console', smsLogs);

    await provider.send('+8801712345678', 'Your order #123456 shipped', 'admin');

    expect(smsLogs.save).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Your order #123456 shipped' }),
    );
  });

  it('logs a failed entry and rethrows when the inner provider fails', async () => {
    const inner: SmsProvider = { send: jest.fn().mockRejectedValue(new Error('boom')) };
    const smsLogs = makeSmsLogsRepo();
    const provider = new LoggingSmsProvider(inner, 'mimsms', smsLogs);

    await expect(provider.send('+8801712345678', 'msg', 'admin')).rejects.toThrow('boom');

    expect(smsLogs.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: SmsLogStatus.FAILED, errorMessage: 'boom' }),
    );
  });
});
