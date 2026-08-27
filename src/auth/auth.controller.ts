import {
  Body,
  Controller,
  Get,
  Logger,
  Next,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
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
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('otp/send')
  @UseGuards(OptionalJwtAuthGuard)
  sendOtp(
    @Body() dto: SendOtpDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.authService.sendOtp(dto, currentUser);
  }

  @Post('otp/verify')
  @UseGuards(OptionalJwtAuthGuard)
  verifyOtp(
    @Body() dto: VerifyOtpDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
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
  googleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    this.handleOAuthCallback('google', req, res, next);
  }

  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  facebookAuth() {}

  @Get('facebook/callback')
  facebookCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    this.handleOAuthCallback('facebook', req, res, next);
  }

  /**
   * Invoked manually (instead of @UseGuards) so a denied/failed consent screen
   * redirects the visitor back to the frontend with ?error=oauth_failed rather
   * than surfacing Nest's raw 401 JSON response. `next` must be forwarded here —
   * Passport's custom-callback form falls back to calling it on some internal
   * error paths, and an omitted `next` throws "next is not a function" instead
   * of reaching our callback at all.
   *
   * The callback body is defensive about the response being sent more than
   * once (guarding on `res.headersSent`, and catching rather than letting
   * anything escape) because a race here previously crashed the whole
   * process: `res.redirect()` throwing `ERR_HTTP_HEADERS_SENT` inside this
   * unawaited async callback became an unhandled rejection, which Node kills
   * the process for by default. One bad OAuth attempt must only fail that
   * request, never take the server down.
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
          try {
            const redirectUrl =
              err || !profile
                ? this.authService.oauthFailureRedirect()
                : await this.authService.buildOAuthRedirect(provider, profile);
            if (!res.headersSent) {
              res.redirect(redirectUrl);
            }
          } catch (redirectError) {
            this.logger.error(
              `${provider} OAuth callback failed`,
              redirectError as Error,
            );
            if (!res.headersSent) {
              res.redirect(this.authService.oauthFailureRedirect());
            }
          }
        })();
      },
    )(req, res, next);
  }
}
