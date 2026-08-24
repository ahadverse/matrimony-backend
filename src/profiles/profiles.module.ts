import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from './entities/profile.entity';
import { Photo } from './entities/photo.entity';
import { User } from '../users/entities/user.entity';
import { ProfileViewUnlock } from '../profile-view/entities/profile-view-unlock.entity';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';
import { PublicProfilesService } from './public-profiles.service';
import { PublicProfilesController } from './public-profiles.controller';
import { PhotoStorageService } from '../common/storage/photo-storage.service';
import { StorageModule } from '../common/storage/storage.module';
import { GeoModule } from '../geo/geo.module';
import { WalletModule } from '../wallet/wallet.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminNotificationsModule } from '../notifications/admin-notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Profile, Photo, User, ProfileViewUnlock]),
    GeoModule,
    StorageModule,
    WalletModule,
    SettingsModule,
    AdminNotificationsModule,
  ],
  providers: [ProfilesService, PublicProfilesService, PhotoStorageService],
  controllers: [ProfilesController, PublicProfilesController],
  exports: [ProfilesService],
})
export class ProfilesModule {}
