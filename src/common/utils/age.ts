export function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

/**
 * Converts an inclusive [ageMin, ageMax] range into the dob bounds that
 * produce it under `calculateAge`'s "birthday already happened this year"
 * rule, so a `dob BETWEEN minDob AND maxDob` query matches exactly the same
 * ages `calculateAge` would report today.
 */
export function getDobBoundsForAgeRange(
  ageMin?: number,
  ageMax?: number,
): { minDob?: string; maxDob?: string } {
  const bounds: { minDob?: string; maxDob?: string } = {};
  const today = new Date();

  if (ageMin != null) {
    const maxDob = new Date(today);
    maxDob.setFullYear(maxDob.getFullYear() - ageMin);
    bounds.maxDob = maxDob.toISOString().slice(0, 10);
  }

  if (ageMax != null) {
    const minDob = new Date(today);
    minDob.setFullYear(minDob.getFullYear() - ageMax - 1);
    minDob.setDate(minDob.getDate() + 1);
    bounds.minDob = minDob.toISOString().slice(0, 10);
  }

  return bounds;
}
