import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Profile } from '../profiles/entities/profile.entity';
import { User } from '../users/entities/user.entity';
import { WalletTransaction } from '../wallet/entities/wallet-transaction.entity';
import { IdentityVerification } from '../verification/entities/identity-verification.entity';
import { AssistantRequest } from '../assistant-requests/entities/assistant-request.entity';
import { ContactMessage } from '../contact-messages/entities/contact-message.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { VerificationExportService } from './verification-export.service';
import { SettingsModule } from '../settings/settings.module';
import { SmsModule } from '../common/sms/sms.module';
import { WalletModule } from '../wallet/wallet.module';
import { SupportModule } from '../support/support.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Profile,
      User,
      WalletTransaction,
      IdentityVerification,
      AssistantRequest,
      ContactMessage,
    ]),
    SettingsModule,
    SmsModule,
    HttpModule,
    WalletModule,
    SupportModule,
  ],
  providers: [AdminService, VerificationExportService],
  controllers: [AdminController],
})
export class AdminModule {}
