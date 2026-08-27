import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactMessage } from './entities/contact-message.entity';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { AdminNotificationsGateway } from '../notifications/admin-notifications.gateway';

@Injectable()
export class ContactMessagesService {
  private readonly logger = new Logger('ContactMessagesService');

  constructor(
    @InjectRepository(ContactMessage)
    private readonly contactMessages: Repository<ContactMessage>,
    private readonly adminNotifications: AdminNotificationsGateway,
  ) {}

  async create(dto: CreateContactMessageDto): Promise<ContactMessage> {
    const message = await this.contactMessages.save(
      this.contactMessages.create(dto),
    );
    try {
      this.adminNotifications.notifyContactMessageCreated({
        id: message.id,
        name: message.name,
        phone: message.phone,
        email: message.email,
        subject: message.subject,
        createdAt: message.createdAt,
      });
    } catch (error) {
      this.logger.error('Failed to push admin notification', error as Error);
    }
    return message;
  }
}
