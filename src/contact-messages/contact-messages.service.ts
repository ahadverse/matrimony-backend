import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactMessage } from './entities/contact-message.entity';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Injectable()
export class ContactMessagesService {
  constructor(
    @InjectRepository(ContactMessage)
    private readonly contactMessages: Repository<ContactMessage>,
  ) {}

  create(dto: CreateContactMessageDto): Promise<ContactMessage> {
    return this.contactMessages.save(this.contactMessages.create(dto));
  }
}
