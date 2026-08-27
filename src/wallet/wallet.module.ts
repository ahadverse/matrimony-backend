import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { NAGAD_GATEWAY } from './gateways/payment-gateway.interface';
import { NagadGateway } from './gateways/nagad.gateway';
import { MockGateway } from './gateways/mock.gateway';
import { AdminNotificationsModule } from '../notifications/admin-notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WalletTransaction]),
    HttpModule,
    SettingsModule,
    AuthModule,
    ChatModule,
    AdminNotificationsModule,
  ],
  providers: [
    WalletService,
    {
      provide: NAGAD_GATEWAY,
      useFactory: (config: ConfigService, http: HttpService) => {
        const configured =
          config.get<string>('NAGAD_MERCHANT_ID') &&
          config.get<string>('NAGAD_MERCHANT_PRIVATE_KEY');
        return configured
          ? new NagadGateway(config, http)
          : new MockGateway('nagad', config);
      },
      inject: [ConfigService, HttpService],
    },
  ],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
