import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-facebook';
import { OAuthProfile } from './oauth-profile';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(config: ConfigService) {
    // Same reasoning as GoogleStrategy: passport-oauth2 throws at construction
    // time if clientID/callbackURL are falsy, so fall back to placeholders
    // rather than crashing the app when Facebook OAuth isn't configured yet.
    super({
      clientID: config.get<string>('FACEBOOK_CLIENT_ID') || 'not-configured',
      clientSecret: config.get<string>('FACEBOOK_CLIENT_SECRET') || 'not-configured',
      callbackURL:
        config.get<string>('FACEBOOK_CALLBACK_URL') ||
        'http://localhost:4000/auth/facebook/callback',
      profileFields: ['id', 'emails', 'name'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: { id: string; emails?: { value: string }[]; displayName?: string },
    done: (err: unknown, profile?: OAuthProfile) => void,
  ) {
    const oauthProfile: OAuthProfile = {
      providerId: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
    };
    done(null, oauthProfile);
  }
}
