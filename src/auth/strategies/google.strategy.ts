import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-google-oauth20';
import { OAuthProfile } from './oauth-profile';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    // passport-oauth2 throws at construction time if clientID/callbackURL are
    // falsy, which would crash the whole app on boot whenever Google OAuth
    // hasn't been configured yet — so fall back to harmless placeholders
    // (an actual /auth/google attempt then fails cleanly at Google, not here),
    // matching this repo's "dev-safe by default" pattern for SMS/payments.
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') || 'not-configured',
      clientSecret:
        config.get<string>('GOOGLE_CLIENT_SECRET') || 'not-configured',
      callbackURL:
        config.get<string>('GOOGLE_CALLBACK_URL') ||
        'http://localhost:4000/auth/google/callback',
      scope: ['profile', 'email'],
    });
  }

  // Return the profile rather than calling passport's `done` — @nestjs/passport
  // wraps this method and invokes `done(null, <returned value>)` itself. Doing
  // both fires the callback twice: the first pass logs the user in, the second
  // arrives with an undefined profile and turns a successful login into
  // ?error=oauth_failed.
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
      // Google returns a sized thumbnail (=s96-c); ask for a larger crop so the
      // seeded profile photo isn't upscaled from 96px.
      avatarUrl: profile.photos?.[0]?.value?.replace(/=s\d+-c$/, '=s512-c'),
    };
  }
}
