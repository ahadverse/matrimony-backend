import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../users/entities/user.entity';
import { Profile } from '../profiles/entities/profile.entity';
import { Photo } from '../profiles/entities/photo.entity';
import { OtpVerification } from './entities/otp-verification.entity';
import { PhotoStorageService } from '../common/storage/photo-storage.service';
import { StorageModule } from '../common/storage/storage.module';
import { SmsModule } from '../common/sms/sms.module';
import { EmailModule } from '../common/email/email.module';
import { SettingsModule } from '../settings/settings.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Profile, Photo, OtpVerification]),
    PassportModule,
    StorageModule,
    SmsModule,
    EmailModule,
    SettingsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') as any,
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    PhotoStorageService,
    JwtStrategy,
    GoogleStrategy,
    FacebookStrategy,
  ],
  controllers: [AuthController],
  exports: [JwtModule],
})
export class AuthModule {}
