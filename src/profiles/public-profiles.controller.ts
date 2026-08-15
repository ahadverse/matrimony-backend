import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PublicProfilesService } from './public-profiles.service';

// Public — this is the directory a visitor lands on before signing up, so it
// sits behind OptionalJwtAuthGuard rather than JwtAuthGuard: anonymous requests
// are served, and a signed-in one additionally gets its unlocked profiles
// returned in full.
@ApiTags('profiles')
@UseGuards(OptionalJwtAuthGuard)
@Controller('profiles')
export class PublicProfilesController {
  constructor(private readonly publicProfiles: PublicProfilesService) {}

  @Get('public')
  list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query('gender') gender?: string,
    @Query('ageMin') ageMin?: string,
    @Query('ageMax') ageMax?: string,
    @Query('heightMinCm') heightMinCm?: string,
    @Query('heightMaxCm') heightMaxCm?: string,
    @Query('division') division?: string,
    @Query('district') district?: string,
    @Query('country') country?: string,
    @Query('education') education?: string,
    @Query('profession') profession?: string,
    @Query('workingSector') workingSector?: string,
    @Query('religion') religion?: string,
    @Query('maritalStatus') maritalStatus?: string,
    @Query('publicId') publicId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.publicProfiles.list(
      {
        gender,
        ageMin: toNumber(ageMin),
        ageMax: toNumber(ageMax),
        heightMinCm: toNumber(heightMinCm),
        heightMaxCm: toNumber(heightMaxCm),
        division,
        district,
        country,
        education,
        profession,
        workingSector,
        religion,
        maritalStatus,
        publicId,
        page: toNumber(page),
        pageSize: toNumber(pageSize),
      },
      user?.userId,
    );
  }
}

/** Query params arrive as strings; a blank or non-numeric one means "no filter". */
function toNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
