import {
  Controller,
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
import { ProfileViewService } from './profile-view.service';

@ApiTags('profile-view')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile-views')
export class ProfileViewController {
  constructor(private readonly profileViewService: ProfileViewService) {}

  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.profileViewService.getMyProfileViews(user.userId);
  }

  @Get(':targetId')
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ) {
    return this.profileViewService.getDetail(user.userId, targetId);
  }

  @Post(':targetId/unlock')
  unlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ) {
    return this.profileViewService.unlock(user.userId, targetId);
  }
}
