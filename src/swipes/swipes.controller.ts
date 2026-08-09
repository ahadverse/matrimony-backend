import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { UsersService } from '../users/users.service';
import { SwipesService } from './swipes.service';
import { CreateSwipeDto } from './dto/create-swipe.dto';

@ApiTags('swipes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SwipesController {
  constructor(
    private readonly swipesService: SwipesService,
    private readonly usersService: UsersService,
  ) {}

  @Get('swipes/browse')
  async browse(
    @CurrentUser() authUser: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('country') country?: string,
    @Query('state') state?: string,
    @Query('city') city?: string,
    @Query('district') district?: string,
    @Query('subDistrict') subDistrict?: string,
    @Query('education') education?: string,
    @Query('profession') profession?: string,
    @Query('religion') religion?: string,
    @Query('maritalStatus') maritalStatus?: string,
    @Query('ageMin') ageMin?: string,
    @Query('ageMax') ageMax?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const me = await this.usersService.findByIdOrThrow(authUser.userId);
    return this.swipesService.getBrowseFeed(me, {
      country,
      state,
      city,
      district,
      subDistrict,
      education,
      profession,
      religion,
      maritalStatus,
      ageMin: ageMin ? Number(ageMin) : undefined,
      ageMax: ageMax ? Number(ageMax) : undefined,
      legacyLimit: limit ? Number(limit) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('swipes/filtered')
  async filtered(@CurrentUser() authUser: AuthenticatedUser) {
    const me = await this.usersService.findByIdOrThrow(authUser.userId);
    return this.swipesService.getFiltered(me);
  }

  @Post('swipes')
  async swipe(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: CreateSwipeDto,
  ) {
    const me = await this.usersService.findByIdOrThrow(authUser.userId);
    return this.swipesService.createSwipe(me, dto);
  }

  @Get('swipes/likes-you')
  async likesYou(@CurrentUser() authUser: AuthenticatedUser) {
    const me = await this.usersService.findByIdOrThrow(authUser.userId);
    return this.swipesService.getLikesYou(me);
  }

  @Get('swipes/my-likes')
  async myLikes(@CurrentUser() authUser: AuthenticatedUser) {
    const me = await this.usersService.findByIdOrThrow(authUser.userId);
    return this.swipesService.getMyLikes(me);
  }
}
