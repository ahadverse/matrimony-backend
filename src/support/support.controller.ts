import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { SupportService } from './support.service';
import { SendSupportMessageDto } from './dto/send-support-message.dto';

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('messages')
  async getMessages(@CurrentUser() user: AuthenticatedUser) {
    const thread = await this.supportService.listThread(user.userId);
    await this.supportService.markReadByUser(user.userId);
    return thread;
  }

  @Post('messages')
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendSupportMessageDto,
  ) {
    return this.supportService.createUserMessage(user.userId, dto.body);
  }
}
