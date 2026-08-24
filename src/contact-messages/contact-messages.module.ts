import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactMessage } from './entities/contact-message.entity';
import { ContactMessagesService } from './contact-messages.service';
import { ContactMessagesController } from './contact-messages.controller';
import { AdminNotificationsModule } from '../notifications/admin-notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([ContactMessage]), AdminNotificationsModule],
  providers: [ContactMessagesService],
  controllers: [ContactMessagesController],
  exports: [TypeOrmModule],
})
export class ContactMessagesModule {}
