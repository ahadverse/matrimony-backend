import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from './entities/profile.entity';
import { Photo } from './entities/photo.entity';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';
import { PhotoStorageService } from '../common/storage/photo-storage.service';
import { StorageModule } from '../common/storage/storage.module';
import { GeoModule } from '../geo/geo.module';
import { WalletModule } from '../wallet/wallet.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Profile, Photo]),
    GeoModule,
    StorageModule,
    WalletModule,
    SettingsModule,
  ],
  providers: [ProfilesService, PhotoStorageService],
  controllers: [ProfilesController],
  exports: [ProfilesService],
})
export class ProfilesModule {}
