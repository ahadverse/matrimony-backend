import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ProfilesService } from './profiles.service';
import { UpsertProfileDto } from './dto/upsert-profile.dto';
import { calculateProfileCompletion } from '../common/utils/profile-completion';

@ApiTags('profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profiles/me')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.profilesService.getMyProfile(user.userId);
    const { percent, missingFields } = calculateProfileCompletion(profile);
    return profile
      ? { ...profile, completionPercent: percent, missingFields }
      : null;
  }

  @Put()
  upsertMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertProfileDto,
  ) {
    return this.profilesService.upsertMyProfile(user.userId, dto);
  }

  @Post('photos')
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
  addPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.profilesService.addPhoto(user.userId, file.buffer);
  }

  @Delete('photos/:photoId')
  deletePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('photoId') photoId: string,
  ) {
    return this.profilesService.deletePhoto(user.userId, photoId);
  }

  @Patch('photos/:photoId/primary')
  setPrimaryPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('photoId') photoId: string,
  ) {
    return this.profilesService.setPrimaryPhoto(user.userId, photoId);
  }

  @Post('spotlight')
  activateSpotlight(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.activateSpotlight(user.userId);
  }
}
