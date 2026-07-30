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
import { randomInt } from 'crypto';
import { User, UserStatus } from '../users/entities/user.entity';
import {
  OtpPurpose,
  OtpVerification,
} from './entities/otp-verification.entity';
import { SMS_PROVIDER } from '../common/sms/sms-provider.interface';
import type { SmsProvider } from '../common/sms/sms-provider.interface';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const OTP_VERIFICATION_SCOPE = 'otp-verified';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(OtpVerification)
    private readonly otps: Repository<OtpVerification>,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    if (dto.purpose !== OtpPurpose.REGISTER) {
      const existing = await this.users.findOne({
        where: { phone: dto.phone },
      });
      if (!existing) {
        throw new BadRequestException('No account found for this phone number');
      }
    } else {
      const existing = await this.users.findOne({
        where: { phone: dto.phone },
      });
      if (existing) {
        throw new ConflictException(
          'An account with this phone number already exists',
        );
      }
    }

    const bypassPhones = (this.config.get<string>('OTP_BYPASS_PHONE') ?? '')
      .split(',')
      .map((phone) => phone.trim())
      .filter(Boolean);
    const isBypass =
      this.config.get<string>('NODE_ENV') !== 'production' &&
      bypassPhones.includes(dto.phone);

    const code = isBypass
      ? this.config.get<string>('OTP_BYPASS_CODE', '123456')
      : randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresMinutes = Number(this.config.get('OTP_EXPIRES_MINUTES', '5'));
    const expiresAt = new Date(Date.now() + expiresMinutes * 60_000);

    await this.otps.save(
      this.otps.create({
        phone: dto.phone,
        codeHash,
        purpose: dto.purpose,
        expiresAt,
      }),
    );

    if (isBypass) {
      this.logger.warn(`OTP bypass active for ${dto.phone} — skipping real SMS`);
    } else {
      await this.sms.send(
        dto.phone,
        `Your Biye Kori verification code is ${code}. It expires in ${expiresMinutes} minutes.`,
      );
    }

    return { success: true, expiresInSeconds: expiresMinutes * 60 };
  }

  async verifyOtp(dto: VerifyOtpDto) {
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
    await this.assertVerificationToken(
      dto.verificationToken,
      dto.phone,
      OtpPurpose.REGISTER,
    );

    const existing = await this.users.findOne({ where: { phone: dto.phone } });
    if (existing) {
      throw new ConflictException(
        'An account with this phone number already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.save(
      this.users.create({
        phone: dto.phone,
        passwordHash,
        gender: dto.gender,
        dob: dto.dob,
        phoneVerifiedAt: new Date(),
      }),
    );

    return this.issueTokenFor(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.phone = :phone', { phone: dto.phone })
      .getOne();
    if (!user)
      throw new UnauthorizedException('Invalid phone number or password');

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches)
      throw new UnauthorizedException('Invalid phone number or password');

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
        gender: user.gender,
        role: user.role,
        status: user.status,
        walletBalance: user.walletBalance,
      },
    };
  }
}
