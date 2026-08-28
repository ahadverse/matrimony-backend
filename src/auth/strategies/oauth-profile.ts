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

/** The name halves passport exposes, whatever the provider filled in. */
export interface OAuthProfileName {
  displayName?: string;
  name?: { givenName?: string; familyName?: string; middleName?: string };
}

/**
 * `displayName` is the provider's full name — but neither provider guarantees
 * it. Facebook only populates it when the `name` graph field is requested
 * (we ask for `first_name`/`last_name` instead, to keep the halves), and
 * Google omits it for accounts whose name is withheld from the profile scope.
 * Falling back to the given/family halves is what keeps the wizard's name
 * field pre-filled instead of silently blank.
 */
export function resolveOAuthName(
  profile: OAuthProfileName,
): string | undefined {
  const displayName = profile.displayName?.trim();
  if (displayName) return displayName;

  const parts = [
    profile.name?.givenName,
    profile.name?.middleName,
    profile.name?.familyName,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part);

  return parts.length ? parts.join(' ') : undefined;
}
