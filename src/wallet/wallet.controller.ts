import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { WalletService } from './wallet.service';
import { TopupDto } from './dto/topup.dto';
import { SubmitManualBkashDto } from './dto/submit-manual-bkash.dto';
import {
  PaymentProvider,
  WalletTransactionType,
} from './entities/wallet-transaction.entity';

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly config: ConfigService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  getBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getBalance(user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('transactions')
  getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: WalletTransactionType,
  ) {
    return this.walletService.getTransactions(
      user.userId,
      Number(page) || 1,
      Number(pageSize) || 20,
      type,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('topup/nagad/init')
  initNagad(@CurrentUser() user: AuthenticatedUser, @Body() dto: TopupDto) {
    return this.walletService.initTopup(
      user.userId,
      PaymentProvider.NAGAD,
      dto.amount,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('topup/bkash/manual')
  submitManualBkash(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitManualBkashDto,
  ) {
    return this.walletService.submitManualBkashTopup(user.userId, dto);
  }

  @Get('topup/nagad/callback')
  async nagadCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.walletService.handleCallback(
      PaymentProvider.NAGAD,
      req.query as Record<string, string>,
    );
    res.redirect(this.resultRedirect(result.success));
  }

  private resultRedirect(success: boolean) {
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    return `${frontendUrl}/checkout/result?status=${success ? 'success' : 'failed'}`;
  }
}
