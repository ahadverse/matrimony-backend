import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { EMAIL_PROVIDER, EmailProvider } from './email-provider.interface';
import { ConsoleEmailProvider } from './console-email.provider';
import { BrevoEmailProvider } from './brevo-email.provider';

@Module({
  imports: [HttpModule],
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useFactory: (config: ConfigService, http: HttpService): EmailProvider => {
        const providerName = config.get<string>('EMAIL_PROVIDER', 'console');
        switch (providerName) {
          case 'brevo':
            return new BrevoEmailProvider(config, http);
          // Add other transactional-email adapters here as they're needed;
          // each just needs to implement EmailProvider.send().
          case 'console':
          default:
            return new ConsoleEmailProvider();
        }
      },
      inject: [ConfigService, HttpService],
    },
  ],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
