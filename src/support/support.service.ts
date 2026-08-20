import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { SupportMessage, SupportSenderRole } from './entities/support-message.entity';
import { User } from '../users/entities/user.entity';
import { ChatGateway } from '../chat/chat.gateway';
import { AdminNotificationsGateway } from '../notifications/admin-notifications.gateway';

const MAX_MESSAGE_LENGTH = 2000;

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportMessage)
    private readonly messages: Repository<SupportMessage>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly chatGateway: ChatGateway,
    private readonly adminNotifications: AdminNotificationsGateway,
  ) {}

  private async userSummary(userId: string) {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { profile: true },
    });
    return {
      id: userId,
      phone: user?.phone ?? '',
      name: user?.profile?.name ?? null,
    };
  }

  async createUserMessage(userId: string, body: string): Promise<SupportMessage> {
    const message = await this.messages.save(
      this.messages.create({
        userId,
        senderId: userId,
        senderRole: SupportSenderRole.USER,
        body: body.trim().slice(0, MAX_MESSAGE_LENGTH),
      }),
    );

    const user = await this.userSummary(userId);
    this.adminNotifications.notifySupportMessage({
      id: message.id,
      userId,
      senderRole: 'user',
      body: message.body,
      createdAt: message.createdAt,
      user,
    });

    return message;
  }

  async createAdminMessage(
    adminId: string,
    userId: string,
    body: string,
  ): Promise<SupportMessage> {
    const message = await this.messages.save(
      this.messages.create({
        userId,
        senderId: adminId,
        senderRole: SupportSenderRole.ADMIN,
        body: body.trim().slice(0, MAX_MESSAGE_LENGTH),
      }),
    );

    this.chatGateway.notifyUser(userId, 'support:message-new', message);

    const user = await this.userSummary(userId);
    this.adminNotifications.notifySupportMessage({
      id: message.id,
      userId,
      senderRole: 'admin',
      body: message.body,
      createdAt: message.createdAt,
      user,
    });

    return message;
  }

  async listThread(userId: string, page = 1, pageSize = 50) {
    const [items, total] = await this.messages.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items: items.reverse(), total, page, pageSize };
  }

  async markReadByUser(userId: string): Promise<void> {
    await this.messages
      .createQueryBuilder()
      .update(SupportMessage)
      .set({ readAt: () => 'now()' })
      .where('userId = :userId', { userId })
      .andWhere('senderRole = :role', { role: SupportSenderRole.ADMIN })
      .andWhere('readAt IS NULL')
      .execute();
  }

  async markReadByAdmin(userId: string): Promise<void> {
    await this.messages
      .createQueryBuilder()
      .update(SupportMessage)
      .set({ readAt: () => 'now()' })
      .where('userId = :userId', { userId })
      .andWhere('senderRole = :role', { role: SupportSenderRole.USER })
      .andWhere('readAt IS NULL')
      .execute();
  }

  async listConversationsForAdmin() {
    const threads = await this.messages
      .createQueryBuilder('m')
      .select('m.userId', 'userId')
      .addSelect('MAX(m.createdAt)', 'lastAt')
      .groupBy('m.userId')
      .orderBy('"lastAt"', 'DESC')
      .getRawMany<{ userId: string; lastAt: Date }>();

    if (threads.length === 0) return [];

    const userIds = threads.map((t) => t.userId);
    const users = await this.users.find({
      where: { id: In(userIds) },
      relations: { profile: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    return Promise.all(
      threads.map(async ({ userId }) => {
        const [lastMessage, unreadCount] = await Promise.all([
          this.messages.findOne({ where: { userId }, order: { createdAt: 'DESC' } }),
          this.messages.count({
            where: { userId, senderRole: SupportSenderRole.USER, readAt: IsNull() },
          }),
        ]);
        const user = userById.get(userId);

        return {
          userId,
          user: {
            id: userId,
            phone: user?.phone ?? '',
            name: user?.profile?.name ?? null,
          },
          lastMessage: lastMessage
            ? {
                body: lastMessage.body,
                senderRole: lastMessage.senderRole,
                createdAt: lastMessage.createdAt,
              }
            : null,
          unreadCount,
        };
      }),
    );
  }
}
