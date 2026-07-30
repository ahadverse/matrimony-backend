import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { SettingsModule } from '../settings/settings.module';
import {
  BKASH_GATEWAY,
  NAGAD_GATEWAY,
} from './gateways/payment-gateway.interface';
import { BkashGateway } from './gateways/bkash.gateway';
import { NagadGateway } from './gateways/nagad.gateway';
import { MockGateway } from './gateways/mock.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([WalletTransaction]),
    HttpModule,
    SettingsModule,
  ],
  providers: [
    WalletService,
    {
      provide: BKASH_GATEWAY,
      useFactory: (config: ConfigService, http: HttpService) => {
        const configured =
          config.get<string>('BKASH_APP_KEY') &&
          config.get<string>('BKASH_USERNAME');
        return configured
          ? new BkashGateway(config, http)
          : new MockGateway('bkash', config);
      },
      inject: [ConfigService, HttpService],
    },
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
