import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from '../profiles/entities/profile.entity';
import { User } from '../users/entities/user.entity';
import { WalletTransaction } from '../wallet/entities/wallet-transaction.entity';
import { IdentityVerification } from '../verification/entities/identity-verification.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SettingsModule } from '../settings/settings.module';
import { SmsModule } from '../common/sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Profile, User, WalletTransaction, IdentityVerification]),
    SettingsModule,
    SmsModule,
  ],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
