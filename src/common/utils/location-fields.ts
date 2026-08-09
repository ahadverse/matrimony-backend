import { Profile } from '../../profiles/entities/profile.entity';

/**
 * The location fields safe to put on someone *else's* card or profile.
 *
 * `zip` is deliberately excluded: it narrows a stranger down to a neighbourhood,
 * and nothing in the UI needs it. It stays on `profiles/me`, which returns the
 * owner their own entity.
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
