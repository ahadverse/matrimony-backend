import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { User } from '../users/entities/user.entity';
import { ConversationsService } from './services/conversations.service';
import { MessagesService } from './services/messages.service';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { ChatImageStorageService } from '../common/storage/chat-image-storage.service';
import { StorageModule } from '../common/storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { BlocksModule } from '../blocks/blocks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, User]),
    AuthModule,
    StorageModule,
    BlocksModule,
  ],
  providers: [
    ConversationsService,
    MessagesService,
    ChatGateway,
    ChatImageStorageService,
  ],
  controllers: [ChatController],
  exports: [ConversationsService, MessagesService, ChatGateway],
})
export class ChatModule {}
