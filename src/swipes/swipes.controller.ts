import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { UsersService } from '../users/users.service';
import { SwipesService } from './swipes.service';
import { CreateSwipeDto } from './dto/create-swipe.dto';

@ApiTags('swipes')
@ApiBearerAuth()
@Controller()
export class SwipesController {
  constructor(
    private readonly swipesService: SwipesService,
    private readonly usersService: UsersService,
  ) {}

  // Guest-viewable: the discover deck is public, so this sits behind
  // OptionalJwtAuthGuard rather than the controller-wide JwtAuthGuard — an
  // anonymous request is served an unpersonalized preview, while a signed-in
  // one gets its usual filtered/excluded feed. Every other route here still
  // requires an account, since swiping/likes are gated per-route below.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('swipes/browse')
  async browse(
    @CurrentUser() authUser: AuthenticatedUser | undefined,
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
    const me = authUser
      ? await this.usersService.findByIdOrThrow(authUser.userId)
      : undefined;
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

  @UseGuards(JwtAuthGuard)
  @Get('swipes/filtered')
  async filtered(@CurrentUser() authUser: AuthenticatedUser) {
    const me = await this.usersService.findByIdOrThrow(authUser.userId);
    return this.swipesService.getFiltered(me);
  }

  @UseGuards(JwtAuthGuard)
  @Post('swipes')
  async swipe(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: CreateSwipeDto,
  ) {
    const me = await this.usersService.findByIdOrThrow(authUser.userId);
    return this.swipesService.createSwipe(me, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('swipes/likes-you')
  async likesYou(@CurrentUser() authUser: AuthenticatedUser) {
    const me = await this.usersService.findByIdOrThrow(authUser.userId);
    return this.swipesService.getLikesYou(me);
  }

  @UseGuards(JwtAuthGuard)
  @Get('swipes/my-likes')
  async myLikes(@CurrentUser() authUser: AuthenticatedUser) {
    const me = await this.usersService.findByIdOrThrow(authUser.userId);
    return this.swipesService.getMyLikes(me);
  }
}
