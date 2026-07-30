import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { User } from '../../users/entities/user.entity';

// Throttle window for lastActiveAt writes so we don't hit the DB on every
// single authenticated request — presence only needs minute-level accuracy.
const ACTIVITY_THROTTLE_MS = 60_000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly lastWriteAt = new Map<string, number>();

  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  validate(payload: {
    sub: string;
    role: AuthenticatedUser['role'];
  }): AuthenticatedUser {
    this.touchActivity(payload.sub);
    return { userId: payload.sub, role: payload.role };
  }

  private touchActivity(userId: string): void {
    const now = Date.now();
    const lastWrite = this.lastWriteAt.get(userId) ?? 0;
    if (now - lastWrite < ACTIVITY_THROTTLE_MS) return;

    this.lastWriteAt.set(userId, now);
    void this.users.update(userId, { lastActiveAt: new Date() });
  }
}
