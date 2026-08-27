import { readFileSync } from 'fs';
import { join } from 'path';

interface DistrictEntry {
  district: string;
  division: string;
  upazilas: string[];
}

const entries = JSON.parse(
  readFileSync(join(__dirname, '../data/bd-geo.json'), 'utf-8'),
) as DistrictEntry[];

const divisionByDistrict = new Map(
  entries.map((e) => [e.district, e.division]),
);

/**
 * Historic or alternate English spellings that older stored data (and the
 * pre-2026 seed) used, mapped onto the names bd-geo.json actually carries.
 * Every entry has been checked to be absent from bd-geo itself, so none of them
 * can shadow a real district.
 */
const DISTRICT_ALIASES: Record<string, string> = {
  Jessore: 'Jashore',
  Bogra: 'Bogura',
  Barisal: 'Barishal',
  Chittagong: 'Chattogram',
  Cumilla: 'Comilla',
  Netrakona: 'Netrokona',
  Jhalakathi: 'Jhalokati',
  Maulvibazar: 'Moulvibazar',
  Moulavibazar: 'Moulvibazar',
  'Chapai Nawabganj': 'Chapainawabganj',
  Nawabganj: 'Chapainawabganj',
  Khagrachari: 'Khagrachhari',
};

/** Resolves a stored district name to its bd-geo.json spelling, if possible. */
export function canonicalBdDistrict(
  district: string | null | undefined,
): string | null {
  if (!district) return null;
  const trimmed = district.trim();
  if (divisionByDistrict.has(trimmed)) return trimmed;
  const alias = DISTRICT_ALIASES[trimmed];
  return alias && divisionByDistrict.has(alias) ? alias : null;
}

/**
 * The 8 divisions. frontend-v3's State dropdown is generated from this same
 * bd-geo.json (see frontend-v3/scripts/build-geo.mjs), so these names match the
 * options a user can actually pick.
 */
export const BD_DIVISIONS = [...new Set(divisionByDistrict.values())].sort();

export function isBdDivision(name: string | null | undefined): boolean {
  return !!name && BD_DIVISIONS.includes(name);
}

export interface WorldwideLocation {
  country: string;
  countryCode: string;
  state: string;
  city: string;
}

/**
 * Maps a legacy Bangladesh district onto the worldwide country/state/city shape.
 *
 * A district sits one level *below* a division, so it belongs in the city slot —
 * which is exactly where frontend-v3's picker lists it. Returns null for an
 * unrecognised district so callers can leave the row alone rather than store a
 * state no dropdown will offer.
 */
export function bdLocationFromDistrict(
  district: string | null | undefined,
): WorldwideLocation | null {
  const canonical = canonicalBdDistrict(district);
  if (!canonical) return null;

  return {
    country: 'Bangladesh',
    countryCode: 'BD',
    state: divisionByDistrict.get(canonical)!,
    city: canonical,
  };
}
