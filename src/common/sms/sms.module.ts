import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SMS_PROVIDER, SmsProvider } from './sms-provider.interface';
import { ConsoleSmsProvider } from './console-sms.provider';
import { ReveSmsProvider } from './reve-sms.provider';
import { MimSmsProvider } from './mimsms.provider';
import { LoggingSmsProvider } from './logging-sms.provider';
import { SmsLog } from './entities/sms-log.entity';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([SmsLog])],
  providers: [
    {
      provide: SMS_PROVIDER,
      useFactory: (
        config: ConfigService,
        http: HttpService,
        smsLogs: Repository<SmsLog>,
      ) => {
        const providerName = config.get<string>('SMS_PROVIDER', 'console');
        let inner: SmsProvider;
        switch (providerName) {
          case 'reve':
            inner = new ReveSmsProvider(config, http);
            break;
          case 'mimsms':
            inner = new MimSmsProvider(config, http);
            break;
          // Add other BD SMS gateway adapters here as they're needed;
          // each just needs to implement SmsProvider.send().
          case 'console':
          default:
            inner = new ConsoleSmsProvider();
            break;
        }
        return new LoggingSmsProvider(inner, providerName, smsLogs);
      },
      inject: [ConfigService, HttpService, getRepositoryToken(SmsLog)],
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
