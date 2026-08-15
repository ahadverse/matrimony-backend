import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Authenticates when a bearer token is present, and lets the request through
 * when it isn't.
 *
 * The public profiles list is the reason this exists: it has to render for a
 * logged-out visitor, but a signed-in one should see which profiles they have
 * already unlocked. `@CurrentUser()` is `undefined` on anonymous requests, so
 * every handler behind this guard must treat the user as optional.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(_err: unknown, user: TUser): TUser | undefined {
    return user || undefined;
  }
}
