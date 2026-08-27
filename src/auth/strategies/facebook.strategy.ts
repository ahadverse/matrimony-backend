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
      clientSecret:
        config.get<string>('FACEBOOK_CLIENT_SECRET') || 'not-configured',
      callbackURL:
        config.get<string>('FACEBOOK_CALLBACK_URL') ||
        'http://localhost:4000/auth/facebook/callback',
      profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
    });
  }

  // Returns rather than calling `done`, for the same reason as GoogleStrategy —
  // @nestjs/passport calls `done(null, <returned value>)` itself, so doing both
  // fires the callback a second time with an undefined profile.
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string;
      emails?: { value: string }[];
      displayName?: string;
      photos?: { value: string }[];
    },
  ): OAuthProfile {
    return {
      providerId: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    };
  }
}
