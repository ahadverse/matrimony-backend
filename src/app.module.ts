import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { buildTypeOrmOptions } from './config/typeorm.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProfilesModule } from './profiles/profiles.module';
import { SwipesModule } from './swipes/swipes.module';
import { WalletModule } from './wallet/wallet.module';
import { ProfileViewModule } from './profile-view/profile-view.module';
import { AdminModule } from './admin/admin.module';
import { SettingsModule } from './settings/settings.module';
import { GeoModule } from './geo/geo.module';
import { MatchesModule } from './matches/matches.module';
import { ChatModule } from './chat/chat.module';
import { VerificationModule } from './verification/verification.module';
import { ShortlistsModule } from './shortlists/shortlists.module';
import { AssistantRequestsModule } from './assistant-requests/assistant-requests.module';
import { ContactMessagesModule } from './contact-messages/contact-messages.module';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: buildTypeOrmOptions,
    }),
    AuthModule,
    UsersModule,
    ProfilesModule,
    SwipesModule,
    WalletModule,
    ProfileViewModule,
    AdminModule,
    SettingsModule,
    GeoModule,
    MatchesModule,
    ChatModule,
    VerificationModule,
    ShortlistsModule,
    AssistantRequestsModule,
    ContactMessagesModule,
    SupportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
