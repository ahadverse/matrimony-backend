import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileViewUnlock } from './entities/profile-view-unlock.entity';
import { Profile } from '../profiles/entities/profile.entity';
import { WalletTransaction } from '../wallet/entities/wallet-transaction.entity';
import { ProfileViewService } from './profile-view.service';
import { ProfileViewController } from './profile-view.controller';
import { SettingsModule } from '../settings/settings.module';
import { MatchesModule } from '../matches/matches.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProfileViewUnlock, Profile, WalletTransaction]),
    SettingsModule,
    MatchesModule,
    ChatModule,
  ],
  providers: [ProfileViewService],
  controllers: [ProfileViewController],
})
export class ProfileViewModule {}
