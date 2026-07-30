import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityVerification } from './entities/identity-verification.entity';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';
import { PhotoStorageService } from '../common/storage/photo-storage.service';
import { StorageModule } from '../common/storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([IdentityVerification]), StorageModule],
  providers: [VerificationService, PhotoStorageService],
  controllers: [VerificationController],
  exports: [VerificationService],
})
export class VerificationModule {}
