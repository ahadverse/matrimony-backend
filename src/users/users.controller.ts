import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { UsersService } from './users.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { UpdateBasicsDto } from './dto/update-basics.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async me(@CurrentUser() user: AuthenticatedUser) {
    const record = await this.usersService.findByIdOrThrow(user.userId);
    return {
      id: record.id,
      phone: record.phone,
      email: record.email,
      gender: record.gender,
      dob: record.dob,
      role: record.role,
      status: record.status,
      walletBalance: record.walletBalance,
      languagePref: record.languagePref,
      hasLocation: record.latitude !== null && record.longitude !== null,
    };
  }

  @Patch('location')
  updateLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.usersService.updateLocation(user.userId, dto);
  }

  @Patch('language')
  updateLanguage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLanguageDto,
  ) {
    return this.usersService.updateLanguage(user.userId, dto);
  }

  @Patch('basics')
  updateBasics(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBasicsDto,
  ) {
    return this.usersService.updateBasics(user.userId, dto);
  }

  @Patch('password')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.userId, dto);
  }
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersActivityController {
  constructor(private readonly usersService: UsersService) {}

  @Get('active')
  async active(@CurrentUser() authUser: AuthenticatedUser) {
    const me = await this.usersService.findByIdOrThrow(authUser.userId);
    return this.usersService.getActiveUsers(me);
  }
}
