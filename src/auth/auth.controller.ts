import { Body, Controller, Get, Next, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { OAuthExchangeDto } from './dto/oauth-exchange.dto';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type { OAuthProfile } from './strategies/oauth-profile';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/send')
  @UseGuards(OptionalJwtAuthGuard)
  sendOtp(@Body() dto: SendOtpDto, @CurrentUser() currentUser?: AuthenticatedUser) {
    return this.authService.sendOtp(dto, currentUser);
  }

  @Post('otp/verify')
  @UseGuards(OptionalJwtAuthGuard)
  verifyOtp(@Body() dto: VerifyOtpDto, @CurrentUser() currentUser?: AuthenticatedUser) {
    return this.authService.verifyOtp(dto, currentUser);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('oauth/exchange')
  exchangeOAuthCode(@Body() dto: OAuthExchangeDto) {
    return this.authService.exchangeOAuthCode(dto.code);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @Get('google/callback')
  googleCallback(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    this.handleOAuthCallback('google', req, res, next);
  }

  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  facebookAuth() {}

  @Get('facebook/callback')
  facebookCallback(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    this.handleOAuthCallback('facebook', req, res, next);
  }

  /**
   * Invoked manually (instead of @UseGuards) so a denied/failed consent screen
   * redirects the visitor back to the frontend with ?error=oauth_failed rather
   * than surfacing Nest's raw 401 JSON response. `next` must be forwarded here —
   * Passport's custom-callback form falls back to calling it on some internal
   * error paths, and an omitted `next` throws "next is not a function" instead
   * of reaching our callback at all.
   */
  private handleOAuthCallback(
    provider: 'google' | 'facebook',
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    passport.authenticate(
      provider,
      { session: false },
      (err: unknown, profile?: OAuthProfile) => {
        void (async () => {
          const redirectUrl =
            err || !profile
              ? this.authService.oauthFailureRedirect()
              : await this.authService.buildOAuthRedirect(provider, profile);
          res.redirect(redirectUrl);
        })();
      },
    )(req, res, next);
  }
}
