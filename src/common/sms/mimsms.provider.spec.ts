import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { MimSmsProvider } from './mimsms.provider';

const CONFIG: Record<string, string> = {
  MIMSMS_BASE_URL: 'https://api.mimsms.com/api',
  MIMSMS_API_KEY: 'test-api-key',
  MIMSMS_USERNAME: 'demo@mimsms.com',
  MIMSMS_SENDER_NAME: 'Biye Kora Lagbe',
};

function makeConfig() {
  return {
    get: jest.fn(
      (key: string, defaultValue?: string) => CONFIG[key] ?? defaultValue,
    ),
  } as unknown as ConfigService;
}

function axiosResponse<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>;
}

describe('MimSmsProvider', () => {
  it('sends the request with the leading + stripped and resolves on status "Success"', async () => {
    const post = jest.fn().mockReturnValue(
      of(
        axiosResponse({
          statusCode: '200',
          status: 'Success',
          trxnId: 'BS8GLB0SEII1P2Z',
          responseResult: 'SMS Send Successfuly',
        }),
      ),
    );
    const http = { post } as unknown as HttpService;
    const provider = new MimSmsProvider(makeConfig(), http);

    await expect(
      provider.send('+8801712345678', 'Your code is 123456'),
    ).resolves.toBeUndefined();

    expect(post).toHaveBeenCalledWith(
      'https://api.mimsms.com/api/V2/SMS',
      expect.objectContaining({
        apiKey: 'test-api-key',
        userName: 'demo@mimsms.com',
        senderName: 'Biye Kora Lagbe',
        transactionType: 'T',
        mobileNumber: '8801712345678',
        message: 'Your code is 123456',
      }),
    );
  });

  it('throws BadGatewayException when MiMSMS responds with a non-Success status', async () => {
    const post = jest.fn().mockReturnValue(
      of(
        axiosResponse({
          statusCode: '206',
          status: 'Failed',
          trxnId: 'A8XCTVMJPEGDI30',
          responseResult: 'Invalid Mobile Number',
        }),
      ),
    );
    const http = { post } as unknown as HttpService;
    const provider = new MimSmsProvider(makeConfig(), http);

    await expect(provider.send('+8801712345678', 'msg')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('throws BadGatewayException when the HTTP call itself fails', async () => {
    const post = jest
      .fn()
      .mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    const http = { post } as unknown as HttpService;
    const provider = new MimSmsProvider(makeConfig(), http);

    await expect(provider.send('+8801712345678', 'msg')).rejects.toThrow(
      BadGatewayException,
    );
  });
});
