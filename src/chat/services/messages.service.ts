import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageType } from '../entities/message.entity';
import { Conversation } from '../entities/conversation.entity';

const MAX_MESSAGE_LENGTH = 2000;

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
  ) {}

  async createTextMessage(
    conversationId: string,
    senderId: string,
    body: string,
  ): Promise<Message> {
    const trimmed = body.trim().slice(0, MAX_MESSAGE_LENGTH);
    const message = await this.messages.save(
      this.messages.create({
        conversationId,
        senderId,
        type: MessageType.TEXT,
        body: trimmed,
      }),
    );
    await this.conversations.update(conversationId, {
      lastMessageAt: message.createdAt,
    });
    return message;
  }

  async createImageMessage(
    conversationId: string,
    senderId: string,
    imageUrl: string,
  ): Promise<Message> {
    const message = await this.messages.save(
      this.messages.create({
        conversationId,
        senderId,
        type: MessageType.IMAGE,
        imageUrl,
      }),
    );
    await this.conversations.update(conversationId, {
      lastMessageAt: message.createdAt,
    });
    return message;
  }

  async markRead(conversationId: string, readerId: string): Promise<void> {
    await this.messages
      .createQueryBuilder()
      .update(Message)
      .set({ readAt: () => 'now()' })
      .where('conversationId = :conversationId', { conversationId })
      .andWhere('senderId != :readerId', { readerId })
      .andWhere('readAt IS NULL')
      .execute();
  }

  async listMessages(conversationId: string, page = 1, pageSize = 50) {
    const [items, total] = await this.messages.findAndCount({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items: items.reverse(), total, page, pageSize };
  }
}
