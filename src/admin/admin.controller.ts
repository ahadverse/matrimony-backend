import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { Gender, UserRole, UserStatus } from '../users/entities/user.entity';
import { VerificationStatus } from '../verification/entities/identity-verification.entity';
import {
  WalletTransactionStatus,
  WalletTransactionType,
} from '../wallet/entities/wallet-transaction.entity';
import { AdminService } from './admin.service';
import { VerificationExportService } from './verification-export.service';
import { RejectProfileDto } from './dto/reject-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SendSmsDto } from './dto/send-sms.dto';
import { AdjustWalletDto } from './dto/adjust-wallet.dto';
import { RejectVerificationDto } from './dto/reject-verification.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly verificationExportService: VerificationExportService,
  ) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('profiles/pending')
  listPending(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('gender') gender?: Gender,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.adminService.listPendingProfiles({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      gender,
      search,
      sortBy,
      sortOrder,
    });
  }

  @Post('profiles/:id/approve')
  approve(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.approveProfile(admin.userId, id);
  }

  @Post('profiles/:id/reject')
  reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectProfileDto,
  ) {
    return this.adminService.rejectProfile(admin.userId, id, dto);
  }

  @Get('profiles/verification')
  listVerification(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('verified') verified?: string,
  ) {
    const verifiedFilter =
      verified === undefined ? undefined : verified === 'true';
    return this.adminService.listApprovedProfiles(
      Number(page) || 1,
      Number(pageSize) || 20,
      verifiedFilter,
    );
  }

  @Post('profiles/:id/verify')
  verify(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.verifyProfile(admin.userId, id);
  }

  @Post('profiles/:id/unverify')
  unverify(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.unverifyProfile(id);
  }

  @Get('users')
  listUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: UserStatus,
    @Query('gender') gender?: Gender,
    @Query('verified') verified?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.adminService.listUsers({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      status,
      gender,
      verified: verified === undefined ? undefined : verified === 'true',
      search,
      sortBy,
      sortOrder,
    });
  }

  @Get('users/:id')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Post('users/:id/ban')
  ban(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.setUserStatus(id, UserStatus.BANNED);
  }

  @Post('users/:id/unban')
  unban(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.setUserStatus(id, UserStatus.ACTIVE);
  }

  @Post('users/:id/wallet-adjust')
  adjustWallet(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustWalletDto,
  ) {
    return this.adminService.adjustWallet(id, dto);
  }

  @Get('verifications/export')
  async exportVerifications(
    @Query('status') status: string | undefined,
    @Res() res: Response,
  ) {
    await this.verificationExportService.streamExport(status, res);
  }

  @Get('verifications')
  listVerificationSubmissions(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: VerificationStatus,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.adminService.listVerificationSubmissions({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      status,
      search,
      sortBy,
      sortOrder,
    });
  }

  @Post('verifications/:id/approve')
  approveVerification(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.approveVerification(admin.userId, id);
  }

  @Post('verifications/:id/reject')
  rejectVerification(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectVerificationDto,
  ) {
    return this.adminService.rejectVerification(admin.userId, id, dto);
  }

  @Get('transactions')
  listTransactions(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('userId') userId?: string,
    @Query('type') type?: WalletTransactionType,
    @Query('status') status?: WalletTransactionStatus,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.adminService.listTransactions({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      userId,
      type,
      status,
      search,
      from,
      to,
      sortBy,
      sortOrder,
    });
  }

  @Get('settings')
  getSettings() {
    return this.adminService.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.adminService.updateSettings(dto);
  }

  @Post('sms/send')
  sendSms(@Body() dto: SendSmsDto) {
    return this.adminService.sendSms(dto);
  }
}
