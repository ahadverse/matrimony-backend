import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportMessage } from './entities/support-message.entity';
import { User } from '../users/entities/user.entity';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { AdminNotificationsModule } from '../notifications/admin-notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportMessage, User]),
    AuthModule,
    ChatModule,
    AdminNotificationsModule,
  ],
  providers: [SupportService],
  controllers: [SupportController],
  exports: [SupportService],
})
export class SupportModule {}
