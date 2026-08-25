import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt, randomUUID } from 'crypto';
import { AuthProvider, User, UserStatus } from '../users/entities/user.entity';
import { Profile } from '../profiles/entities/profile.entity';
import {
  OtpChannel,
  OtpPurpose,
  OtpVerification,
} from './entities/otp-verification.entity';
import { SMS_PROVIDER } from '../common/sms/sms-provider.interface';
import type { SmsProvider } from '../common/sms/sms-provider.interface';
import { EMAIL_PROVIDER } from '../common/email/email-provider.interface';
import type { EmailProvider } from '../common/email/email-provider.interface';
import { SettingsService } from '../settings/settings.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type { OAuthProfile } from './strategies/oauth-profile';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const OTP_VERIFICATION_SCOPE = 'otp-verified';
const OAUTH_EXCHANGE_SCOPE = 'oauth-exchange';

const OTP_TEMPLATE_FIELD: Record<
  OtpPurpose,
  'smsTemplateOtpRegister' | 'smsTemplateOtpLogin' | 'smsTemplateOtpReset'
> = {
  [OtpPurpose.REGISTER]: 'smsTemplateOtpRegister',
  [OtpPurpose.LOGIN]: 'smsTemplateOtpLogin',
  [OtpPurpose.RESET]: 'smsTemplateOtpReset',
};

function renderSmsTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (message, [key, value]) => message.split(`{${key}}`).join(value),
    template,
  );
}

/** Only Bangladesh has an SMS gateway wired up — everywhere else falls back to email. */
function isBangladeshiPhone(phone: string): boolean {
  return phone.replace(/[\s-]/g, '').startsWith('+880');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // OAuth exchange codes are short-lived signed JWTs (no DB row), so single-use
  // enforcement lives here: a redeemed jti is remembered until its own token
  // would have expired anyway, then dropped so this never grows unbounded.
  private readonly consumedOAuthCodes = new Set<string>();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(OtpVerification)
    private readonly otps: Repository<OtpVerification>,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly settings: SettingsService,
  ) {}

  async sendOtp(dto: SendOtpDto, currentUser?: AuthenticatedUser) {
    if (dto.purpose === OtpPurpose.REGISTER) {
      return this.sendContactVerificationOtp(dto, currentUser);
    }

    const existing = await this.users.findOne({ where: { phone: dto.phone } });
    if (!existing) {
      throw new BadRequestException('No account found for this phone number');
    }

    return this.dispatchSmsOtp(dto.phone, dto.purpose);
  }

  /**
   * The wizard's last step: an already-registered user attaching and
   * verifying a phone number. Bangladeshi numbers get a real SMS; everywhere
   * else (no SMS gateway coverage) the same code goes to the account's email
   * instead.
   */
  private async sendContactVerificationOtp(dto: SendOtpDto, currentUser?: AuthenticatedUser) {
    if (!currentUser) {
      throw new UnauthorizedException('Sign in required to verify a phone number');
    }

    const phoneTaken = await this.users.findOne({ where: { phone: dto.phone } });
    if (phoneTaken && phoneTaken.id !== currentUser.userId) {
      throw new ConflictException('An account with this phone number already exists');
    }

    if (isBangladeshiPhone(dto.phone)) {
      return this.dispatchSmsOtp(dto.phone, dto.purpose, OtpChannel.SMS);
    }

    const user = await this.users.findOne({ where: { id: currentUser.userId } });
    if (!user?.email) {
      throw new BadRequestException(
        'Add an email to your account before verifying a non-Bangladesh phone number',
      );
    }

    const code = randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresMinutes = Number(this.config.get('OTP_EXPIRES_MINUTES', '5'));
    const expiresAt = new Date(Date.now() + expiresMinutes * 60_000);

    await this.otps.save(
      this.otps.create({
        phone: dto.phone,
        codeHash,
        purpose: dto.purpose,
        channel: OtpChannel.EMAIL,
        expiresAt,
      }),
    );

    await this.email.send(
      user.email,
      'Your verification code',
      `Your BiyeKoraLagbe verification code is ${code}. It expires in ${expiresMinutes} minutes.`,
      `otp_${dto.purpose}`,
    );

    return { success: true, channel: OtpChannel.EMAIL, expiresInSeconds: expiresMinutes * 60 };
  }

  private async dispatchSmsOtp(
    phone: string,
    purpose: OtpPurpose,
    channel: OtpChannel = OtpChannel.SMS,
  ) {
    const isBypass = false;

    const code = isBypass
      ? this.config.get<string>('OTP_BYPASS_CODE', '123456')
      : randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresMinutes = Number(this.config.get('OTP_EXPIRES_MINUTES', '5'));
    const expiresAt = new Date(Date.now() + expiresMinutes * 60_000);

    await this.otps.save(
      this.otps.create({ phone, codeHash, purpose, channel, expiresAt }),
    );

    if (isBypass) {
      this.logger.warn(`OTP bypass active for ${phone} — skipping real SMS`);
    } else {
      const settings = await this.settings.get();
      const template = settings[OTP_TEMPLATE_FIELD[purpose]];
      const message = renderSmsTemplate(template, {
        code,
        minutes: String(expiresMinutes),
      });
      await this.sms.send(phone, message, `otp_${purpose}`);
    }

    return { success: true, channel, expiresInSeconds: expiresMinutes * 60 };
  }

  async verifyOtp(dto: VerifyOtpDto, currentUser?: AuthenticatedUser) {
    if (dto.purpose === OtpPurpose.REGISTER && !currentUser) {
      throw new UnauthorizedException('Sign in required to verify a phone number');
    }

    const otp = await this.otps.findOne({
      where: { phone: dto.phone, purpose: dto.purpose, consumed: false },
      order: { createdAt: 'DESC' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException(
        'OTP expired or not found, please request a new one',
      );
    }
    if (otp.attempts >= 5) {
      throw new BadRequestException(
        'Too many attempts, please request a new OTP',
      );
    }

    const matches = await bcrypt.compare(dto.code, otp.codeHash);
    if (!matches) {
      otp.attempts += 1;
      await this.otps.save(otp);
      throw new BadRequestException('Incorrect code');
    }

    otp.consumed = true;
    await this.otps.save(otp);

    if (dto.purpose === OtpPurpose.REGISTER) {
      const user = await this.users.findOneOrFail({ where: { id: currentUser!.userId } });
      user.phone = dto.phone;
      if (otp.channel === OtpChannel.SMS) {
        user.phoneVerifiedAt = new Date();
      } else {
        user.emailVerifiedAt = new Date();
      }
      await this.users.save(user);
      return { success: true };
    }

    const verificationToken = await this.jwt.signAsync(
      { phone: dto.phone, purpose: dto.purpose, scope: OTP_VERIFICATION_SCOPE },
      { expiresIn: '15m' },
    );

    return { verificationToken };
  }

  private async assertVerificationToken(
    token: string,
    phone: string,
    purpose: OtpPurpose,
  ) {
    let payload: { phone: string; purpose: OtpPurpose; scope: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new BadRequestException('Invalid or expired verification token');
    }
    if (
      payload.scope !== OTP_VERIFICATION_SCOPE ||
      payload.phone !== phone ||
      payload.purpose !== purpose
    ) {
      throw new BadRequestException(
        'Verification token does not match this request',
      );
    }
  }

  async register(dto: RegisterDto) {
    const emailTaken = await this.users.findOne({ where: { email: dto.email } });
    if (emailTaken) {
      throw new ConflictException(
        'An account with this email address already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.save(
      this.users.create({
        email: dto.email,
        passwordHash,
        gender: dto.gender ?? null,
        dob: dto.dob ?? null,
        authProvider: AuthProvider.LOCAL,
      }),
    );

    return this.issueTokenFor(user);
  }

  async login(dto: LoginDto) {
    const isEmail = dto.identifier.includes('@');
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where(isEmail ? 'user.email = :identifier' : 'user.phone = :identifier', {
        identifier: dto.identifier,
      })
      .getOne();
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) throw new UnauthorizedException('Invalid credentials');

    if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('This account has been banned');
    }

    return this.issueTokenFor(user);
  }

  async resetPassword(dto: ResetPasswordDto) {
    await this.assertVerificationToken(
      dto.verificationToken,
      dto.phone,
      OtpPurpose.RESET,
    );

    const user = await this.users.findOne({ where: { phone: dto.phone } });
    if (!user)
      throw new BadRequestException('No account found for this phone number');

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.users.save(user);

    return this.issueTokenFor(user);
  }

  /**
   * Resolves a Google/Facebook profile to a user (linking it onto an existing
   * email/password account if one matches, otherwise creating a new one), then
   * mints a short-lived signed code for the frontend to redeem at
   * POST /auth/oauth/exchange. A one-time code — rather than the real access
   * token — keeps the long-lived credential out of the redirect URL, so it
   * never lands in browser history, the Referer header, or server logs.
   */
  async buildOAuthRedirect(
    provider: 'google' | 'facebook',
    profile: OAuthProfile,
  ): Promise<string> {
    const frontendUrl = this.frontendUrl();
    try {
      const { user, needsOnboarding } = await this.completeOAuthLogin(provider, profile);
      if (user.status === UserStatus.BANNED) {
        return `${frontendUrl}/callback?error=account_banned`;
      }
      const code = await this.jwt.signAsync(
        { sub: user.id, scope: OAUTH_EXCHANGE_SCOPE, needsOnboarding, jti: randomUUID() },
        { expiresIn: '2m' },
      );
      return `${frontendUrl}/callback?code=${code}`;
    } catch (error) {
      this.logger.error(`${provider} OAuth login failed`, error as Error);
      return this.oauthFailureRedirect();
    }
  }

  oauthFailureRedirect(): string {
    return `${this.frontendUrl()}/callback?error=oauth_failed`;
  }

  private frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  private async completeOAuthLogin(
    provider: 'google' | 'facebook',
    profile: OAuthProfile,
  ): Promise<{ user: User; needsOnboarding: boolean }> {
    if (!profile.email) {
      throw new BadRequestException(`${provider} account has no email`);
    }

    const idField = provider === 'google' ? 'googleId' : 'facebookId';
    const authProvider = provider === 'google' ? AuthProvider.GOOGLE : AuthProvider.FACEBOOK;

    let user = await this.users.findOne({ where: { [idField]: profile.providerId } });

    if (!user) {
      // Not linked yet — an existing email/password account with the same
      // email gets Google/Facebook attached to it rather than duplicated;
      // otherwise this really is a brand new member.
      user = await this.users.findOne({ where: { email: profile.email } });
      if (user) {
        user[idField] = profile.providerId;
        await this.users.save(user);
      } else {
        user = await this.users.save(
          this.users.create({
            email: profile.email,
            [idField]: profile.providerId,
            authProvider,
            passwordHash: null,
            emailVerifiedAt: new Date(),
          }),
        );
      }
    }

    return { user, needsOnboarding: await this.needsOnboarding(user.id) };
  }

  /**
   * Whether this account still needs to go through the bio-data wizard —
   * *not* whether the User row was just created. A Google/Facebook login can
   * resolve to a User that has existed for a while (linked onto an older
   * email/password account, or a member who closed the tab mid-wizard on a
   * previous OAuth login) with no profile started at all; `name` is the
   * first field the wizard's Basic Info step writes, so its absence means
   * the member has never gotten that far.
   */
  private async needsOnboarding(userId: string): Promise<boolean> {
    const profile = await this.profiles.findOne({ where: { userId } });
    return !profile?.name;
  }

  async exchangeOAuthCode(code: string) {
    let payload: { sub: string; scope: string; needsOnboarding: boolean; jti: string };
    try {
      payload = await this.jwt.verifyAsync(code);
    } catch {
      throw new BadRequestException('Invalid or expired login link');
    }
    if (payload.scope !== OAUTH_EXCHANGE_SCOPE || this.consumedOAuthCodes.has(payload.jti)) {
      throw new BadRequestException('Invalid or expired login link');
    }
    this.consumedOAuthCodes.add(payload.jti);
    setTimeout(() => this.consumedOAuthCodes.delete(payload.jti), 3 * 60_000).unref();

    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Account no longer exists');
    if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('This account has been banned');
    }

    return {
      ...(await this.issueTokenFor(user)),
      needsOnboarding: payload.needsOnboarding,
    };
  }

  private async issueTokenFor(user: User) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
    });
    return {
      accessToken,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        gender: user.gender,
        role: user.role,
        status: user.status,
        walletBalance: user.walletBalance,
      },
    };
  }
}
