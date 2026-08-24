import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { ConversationsService } from './services/conversations.service';
import { MessagesService } from './services/messages.service';
import type { Conversation } from './entities/conversation.entity';
import { BlocksService } from '../blocks/blocks.service';

interface AuthedSocket extends Socket {
  data: { userId: string };
}

// @WebSocketGateway CORS is evaluated at class-definition time (can't inject ConfigService here),
// so it reads process.env directly rather than going through the ConfigService used elsewhere.
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly blocksService: BlocksService,
  ) {}

  private otherParticipant(conversation: Conversation, userId: string): string {
    return conversation.userAId === userId
      ? conversation.userBId
      : conversation.userAId;
  }

  handleConnection(socket: AuthedSocket) {
    // Room membership must not depend on an async DB lookup here: the client's 'connect' event
    // fires as soon as the handshake completes, independent of how long this handler takes — so any
    // room join that requires an `await` first is a race a client could beat by emitting immediately
    // after connecting. Joining `user:${userId}` needs no DB call, so it's safe to do synchronously.
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      socket.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      socket.data.userId = payload.sub;
    } catch {
      socket.disconnect(true);
      return;
    }

    void socket.join(`user:${socket.data.userId}`);
  }

  private otherParticipantRooms(conversation: Conversation): string[] {
    return [`user:${conversation.userAId}`, `user:${conversation.userBId}`];
  }

  @SubscribeMessage('message:send')
  async handleSend(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { conversationId?: string; body?: string },
  ) {
    if (
      typeof body?.conversationId !== 'string' ||
      typeof body?.body !== 'string' ||
      !body.body.trim()
    ) {
      return;
    }

    let conversation: Conversation;
    try {
      conversation = await this.conversationsService.assertParticipant(
        body.conversationId,
        socket.data.userId,
      );
    } catch {
      return;
    }

    const otherUserId = this.otherParticipant(conversation, socket.data.userId);
    if (await this.blocksService.isBlockedEitherWay(socket.data.userId, otherUserId)) {
      socket.emit('message:blocked', { conversationId: body.conversationId });
      return;
    }

    const message = await this.messagesService.createTextMessage(
      body.conversationId,
      socket.data.userId,
      body.body,
    );
    this.server
      .to(this.otherParticipantRooms(conversation))
      .emit('message:new', message);
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { conversationId?: string },
  ) {
    await this.broadcastTyping(socket, body, true);
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { conversationId?: string },
  ) {
    await this.broadcastTyping(socket, body, false);
  }

  private async broadcastTyping(
    socket: AuthedSocket,
    body: { conversationId?: string },
    typing: boolean,
  ) {
    if (typeof body?.conversationId !== 'string') return;

    let conversation: Conversation;
    try {
      conversation = await this.conversationsService.assertParticipant(
        body.conversationId,
        socket.data.userId,
      );
    } catch {
      return;
    }

    const otherUserId =
      conversation.userAId === socket.data.userId
        ? conversation.userBId
        : conversation.userAId;
    this.server.to(`user:${otherUserId}`).emit('typing:update', {
      conversationId: body.conversationId,
      userId: socket.data.userId,
      typing,
    });
  }

  @SubscribeMessage('message:read')
  async handleRead(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { conversationId?: string },
  ) {
    if (typeof body?.conversationId !== 'string') return;

    let conversation: Conversation;
    try {
      conversation = await this.conversationsService.assertParticipant(
        body.conversationId,
        socket.data.userId,
      );
    } catch {
      return;
    }

    await this.messagesService.markRead(
      body.conversationId,
      socket.data.userId,
    );
    this.server
      .to(this.otherParticipantRooms(conversation))
      .emit('message:read', {
        conversationId: body.conversationId,
        readerId: socket.data.userId,
        readAt: new Date(),
      });
  }

  broadcastMessage(conversation: Conversation, message: unknown) {
    this.server
      .to(this.otherParticipantRooms(conversation))
      .emit('message:new', message);
  }

  /**
   * Every logged-in user already holds a `user:${userId}` room membership on
   * this socket (see handleConnection) since the frontend keeps it open
   * app-wide for chat. Other modules reuse it as the generic push channel
   * rather than opening a second per-user socket connection.
   */
  notifyUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
