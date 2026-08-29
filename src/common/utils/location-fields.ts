import { Profile } from '../../profiles/entities/profile.entity';

/**
 * The location fields safe to put on someone *else's* card or profile.
 *
 * `zip` is deliberately excluded: it narrows a stranger down to a neighbourhood.
 * It rides on `profiles/me` (the owner's own entity) and on an *unlocked*
 * profile, which adds it alongside the street addresses — see
 * `unlockedProfileFields`. Cards and locked views never carry it.
 *
 * `district`/`subDistrict` ride along because the admin panel and the older
 * frontends still read them; ProfilesService keeps them mirrored to state/city.
 */
export function publicLocationFields(profile: Profile) {
  return {
    district: profile.district,
    subDistrict: profile.subDistrict,
    country: profile.country,
    countryCode: profile.countryCode,
    state: profile.state,
    city: profile.city,
  };
}

/**
 * The narrower set a *locked* profile may carry.
 *
 * Division and country are what the directory filters on and neither points at
 * a person, so they stay. The district — `city` on the worldwide columns, and
 * the legacy `district`/`subDistrict` pair mirrored from them — is held back
 * until the profile is unlocked: paired with the bio-data already on show, a
 * home district narrows someone down far enough to find them off-platform,
 * which is the whole of what the unlock fee is charged for.
 */
export function lockedLocationFields(profile: Profile) {
  return {
    country: profile.country,
    countryCode: profile.countryCode,
    state: profile.state,
  };
}
