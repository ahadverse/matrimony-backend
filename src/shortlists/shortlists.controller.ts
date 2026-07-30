import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { UsersService } from '../users/users.service';
import { ShortlistsService } from './shortlists.service';

@ApiTags('shortlists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shortlists')
export class ShortlistsController {
  constructor(
    private readonly shortlistsService: ShortlistsService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async list(@CurrentUser() authUser: AuthenticatedUser) {
    const me = await this.usersService.findByIdOrThrow(authUser.userId);
    return this.shortlistsService.list(me);
  }

  @Post(':targetId')
  add(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ) {
    return this.shortlistsService.add(authUser.userId, targetId);
  }

  @Delete(':targetId')
  remove(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ) {
    return this.shortlistsService.remove(authUser.userId, targetId);
  }
}
