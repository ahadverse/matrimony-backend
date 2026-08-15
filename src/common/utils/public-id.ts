import { randomInt } from 'crypto';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * One candidate public profile id: four letters then four digits (`CBIC5526`).
 *
 * Uniqueness is *not* guaranteed here — the caller checks it against the
 * unique `profiles.publicId` index and retries. Letters and digits are drawn
 * with `randomInt` rather than `Math.random` so ids can't be predicted from an
 * earlier one, which matters because they are the only handle a member has on
 * a profile they haven't paid to unlock.
 */
export function buildPublicIdCandidate(): string {
  let id = '';
  for (let i = 0; i < 4; i += 1) id += LETTERS[randomInt(LETTERS.length)];
  return `${id}${randomInt(1000, 10000)}`;
}
