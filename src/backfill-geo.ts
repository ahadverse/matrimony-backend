import { NestFactory } from '@nestjs/core';
import { DataSource, IsNull, Not } from 'typeorm';
import { AppModule } from './app.module';
import { Profile } from './profiles/entities/profile.entity';
import {
  bdLocationFromDistrict,
  isBdDivision,
} from './common/utils/bd-location';

/**
 * Fills the worldwide country/state/city columns for profiles that predate them.
 *
 * Those rows only carry `district`/`subDistrict`, which was Bangladesh-only by
 * definition, so the division that district belongs to becomes the state and the
 * district itself becomes the city — matching what frontend-v3's picker offers.
 *
 * It also repairs rows where `state` holds a *district* rather than a division,
 * which is what an earlier version of this script wrote before the dropdown was
 * corrected to list only the 8 divisions.
 *
 * Safe to re-run: rows already sitting on a valid division are skipped.
 *
 *   npm run backfill:geo
 */
async function backfillGeo() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const profiles = app.get(DataSource).getRepository(Profile);

  const candidates = await profiles.find({
    where: { district: Not(IsNull()) },
  });

  const changed: Profile[] = [];
  const unmapped: string[] = [];

  for (const profile of candidates) {
    // Already on a real division, and outside Bangladesh, nothing to do.
    if (profile.country && profile.country !== 'Bangladesh') continue;
    if (isBdDivision(profile.state) && profile.city) continue;

    const mapped = bdLocationFromDistrict(profile.district);
    if (!mapped) {
      unmapped.push(profile.district!);
      continue;
    }

    profile.country = mapped.country;
    profile.countryCode = mapped.countryCode;
    profile.state = mapped.state;
    profile.city = mapped.city;
    changed.push(profile);
  }

  if (changed.length === 0) {
    console.log(
      'Nothing to backfill — every profile already has a valid division.',
    );
  } else {
    await profiles.save(changed);
    console.log(
      `Backfilled ${changed.length} profile(s) to division / district.`,
    );
  }

  if (unmapped.length > 0) {
    const counts = [...new Set(unmapped)].map(
      (d) => `${d} (${unmapped.filter((x) => x === d).length})`,
    );
    console.log(
      `Left alone — district not in bd-geo.json: ${counts.join(', ')}`,
    );
  }

  await app.close();
}

backfillGeo().catch((error) => {
  console.error(error);
  process.exit(1);
});
