import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { ReveSmsProvider } from './reve-sms.provider';

const CONFIG: Record<string, string> = {
  REVE_BASE_URL: 'https://smpp.revesms.com:7790',
  REVE_API_KEY: 'test-api-key',
  REVE_SECRET_KEY: 'test-secret-key',
  REVE_CALLER_ID: 'Biye Kora Lagbe',
};

function makeConfig() {
  return {
    get: jest.fn((key: string) => CONFIG[key]),
  } as unknown as ConfigService;
}

function axiosResponse<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>;
}

describe('ReveSmsProvider', () => {
  it('sends the request with the leading + stripped and resolves on Status "0"', async () => {
    const post = jest
      .fn()
      .mockReturnValue(
        of(axiosResponse({ Status: '0', Text: 'ACCEPTD', Message_ID: '444' })),
      );
    const http = { post } as unknown as HttpService;
    const provider = new ReveSmsProvider(makeConfig(), http);

    await expect(
      provider.send('+8801712345678', 'Your code is 123456'),
    ).resolves.toBeUndefined();

    expect(post).toHaveBeenCalledWith(
      'https://smpp.revesms.com:7790/sendtext',
      expect.objectContaining({
        apikey: 'test-api-key',
        secretkey: 'test-secret-key',
        callerID: 'Biye Kora Lagbe',
        toUser: '8801712345678',
        messageContent: 'Your code is 123456',
      }),
    );
  });

  it('throws BadGatewayException when REVE responds with a non-zero Status', async () => {
    const post = jest
      .fn()
      .mockReturnValue(of(axiosResponse({ Status: '108', Text: 'REJECTD' })));
    const http = { post } as unknown as HttpService;
    const provider = new ReveSmsProvider(makeConfig(), http);

    await expect(provider.send('+8801712345678', 'msg')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('throws BadGatewayException when the HTTP call itself fails', async () => {
    const post = jest
      .fn()
      .mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    const http = { post } as unknown as HttpService;
    const provider = new ReveSmsProvider(makeConfig(), http);

    await expect(provider.send('+8801712345678', 'msg')).rejects.toThrow(
      BadGatewayException,
    );
  });
});
