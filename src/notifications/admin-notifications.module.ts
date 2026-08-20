import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminNotificationsGateway } from './admin-notifications.gateway';

@Module({
  imports: [AuthModule],
  providers: [AdminNotificationsGateway],
  exports: [AdminNotificationsGateway],
})
export class AdminNotificationsModule {}
