import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ConversationsService } from './services/conversations.service';
import { MessagesService } from './services/messages.service';
import { ChatImageStorageService } from '../common/storage/chat-image-storage.service';
import { ChatGateway } from './chat.gateway';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ChatController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly chatImageStorage: ChatImageStorageService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('conversations')
  listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.listForUser(user.userId);
  }

  @Get('conversations/unread-count')
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    const conversations = await this.conversationsService.listForUser(
      user.userId,
    );
    return { count: conversations.reduce((sum, c) => sum + c.unreadCount, 0) };
  }

  @Get('conversations/:id/messages')
  async listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    await this.conversationsService.assertParticipant(id, user.userId);
    return this.messagesService.listMessages(
      id,
      Number(page) || 1,
      Number(pageSize) || 50,
    );
  }

  @Post('conversations/:id/photos')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async sendPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const conversation = await this.conversationsService.assertParticipant(
      id,
      user.userId,
    );

    const { url } = await this.chatImageStorage.saveImage(file.buffer);
    const message = await this.messagesService.createImageMessage(
      id,
      user.userId,
      url,
    );
    this.chatGateway.broadcastMessage(conversation, message);
    return message;
  }
}
