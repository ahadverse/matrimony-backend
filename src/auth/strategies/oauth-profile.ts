export interface OAuthProfile {
  providerId: string;
  email?: string;
  name?: string;
  /**
   * The provider's avatar URL. Seeded as the member's first profile photo on
   * signup so the wizard's photo step starts with something rather than
   * nothing — they can still replace it there.
   */
  avatarUrl?: string;
}
