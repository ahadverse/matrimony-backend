import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { SMS_PROVIDER } from './sms-provider.interface';
import { ConsoleSmsProvider } from './console-sms.provider';
import { ReveSmsProvider } from './reve-sms.provider';

@Module({
  imports: [HttpModule],
  providers: [
    {
      provide: SMS_PROVIDER,
      useFactory: (config: ConfigService, http: HttpService) => {
        const provider = config.get<string>('SMS_PROVIDER', 'console');
        switch (provider) {
          case 'reve':
            return new ReveSmsProvider(config, http);
          // Add other BD SMS gateway adapters here as they're needed;
          // each just needs to implement SmsProvider.send().
          case 'console':
          default:
            return new ConsoleSmsProvider();
        }
      },
      inject: [ConfigService, HttpService],
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
