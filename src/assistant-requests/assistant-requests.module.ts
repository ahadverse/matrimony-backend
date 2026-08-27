import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssistantRequest } from './entities/assistant-request.entity';
import { AssistantRequestsService } from './assistant-requests.service';
import { AssistantRequestsController } from './assistant-requests.controller';
import { AdminNotificationsModule } from '../notifications/admin-notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssistantRequest]),
    AdminNotificationsModule,
  ],
  providers: [AssistantRequestsService],
  controllers: [AssistantRequestsController],
  exports: [TypeOrmModule],
})
export class AssistantRequestsModule {}
