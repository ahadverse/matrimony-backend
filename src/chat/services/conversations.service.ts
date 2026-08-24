import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { Message, MessageType } from '../entities/message.entity';
import { User } from '../../users/entities/user.entity';
import { Match } from '../../matches/entities/match.entity';
import { BlocksService } from '../../blocks/blocks.service';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly blocksService: BlocksService,
  ) {}

  async getOrCreateForMatch(match: Match): Promise<Conversation> {
    const existing = await this.conversations.findOne({
      where: { matchId: match.id },
    });
    if (existing) return existing;

    try {
      return await this.conversations.save(
        this.conversations.create({
          matchId: match.id,
          userAId: match.userAId,
          userBId: match.userBId,
        }),
      );
    } catch {
      return this.conversations.findOneOrFail({ where: { matchId: match.id } });
    }
  }

  async getById(conversationId: string): Promise<Conversation | null> {
    return this.conversations.findOne({ where: { id: conversationId } });
  }

  async assertParticipant(
    conversationId: string,
    userId: string,
  ): Promise<Conversation> {
    const conversation = await this.getById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.userAId !== userId && conversation.userBId !== userId) {
      throw new ForbiddenException('You are not part of this conversation');
    }
    return conversation;
  }

  async listForUser(userId: string) {
    const conversations = await this.conversations.find({
      where: [{ userAId: userId }, { userBId: userId }],
      order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
    });
    if (conversations.length === 0) return [];

    const otherUserIds = conversations.map((c) =>
      c.userAId === userId ? c.userBId : c.userAId,
    );
    const [others, blockedByMeIds, blockedMeIds] = await Promise.all([
      this.users.find({
        where: { id: In(otherUserIds) },
        relations: { profile: { photos: true } },
      }),
      this.blocksService.listBlockedUserIds(userId),
      this.blocksService.listBlockerIds(userId),
    ]);
    const otherById = new Map(others.map((u) => [u.id, u]));
    const blockedByMeSet = new Set(blockedByMeIds);
    const blockedMeSet = new Set(blockedMeIds);

    return Promise.all(
      conversations.map(async (conversation) => {
        const otherUserId =
          conversation.userAId === userId
            ? conversation.userBId
            : conversation.userAId;
        const other = otherById.get(otherUserId);
        const primaryPhoto =
          other?.profile?.photos.find((p) => p.isPrimary) ??
          other?.profile?.photos[0] ??
          null;

        const [lastMessage, unreadCount] = await Promise.all([
          this.messages.findOne({
            where: { conversationId: conversation.id },
            order: { createdAt: 'DESC' },
          }),
          this.messages
            .createQueryBuilder('m')
            .where('m.conversationId = :id', { id: conversation.id })
            .andWhere('m.senderId = :otherUserId', { otherUserId })
            .andWhere('m.readAt IS NULL')
            .getCount(),
        ]);

        return {
          id: conversation.id,
          otherUser: other
            ? {
                id: other.id,
                name: other.profile?.name ?? null,
                photoUrl: primaryPhoto?.url ?? null,
                isVerified: other.profile?.isVerified ?? false,
                district: other.profile?.district ?? null,
                city: other.profile?.city ?? null,
                state: other.profile?.state ?? null,
              }
            : null,
          lastMessage: lastMessage
            ? {
                preview:
                  lastMessage.type === MessageType.IMAGE
                    ? '[Photo]'
                    : lastMessage.body,
                senderId: lastMessage.senderId,
                createdAt: lastMessage.createdAt,
              }
            : null,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount,
          blockedByMe: blockedByMeSet.has(otherUserId),
          blockedByOther: blockedMeSet.has(otherUserId),
        };
      }),
    );
  }
}
