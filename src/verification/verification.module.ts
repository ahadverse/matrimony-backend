import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityVerification } from './entities/identity-verification.entity';
import { User } from '../users/entities/user.entity';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';
import { PhotoStorageService } from '../common/storage/photo-storage.service';
import { StorageModule } from '../common/storage/storage.module';
import { AdminNotificationsModule } from '../notifications/admin-notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IdentityVerification, User]),
    StorageModule,
    AdminNotificationsModule,
  ],
  providers: [VerificationService, PhotoStorageService],
  controllers: [VerificationController],
  exports: [VerificationService],
})
export class VerificationModule {}
