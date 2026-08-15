import { NestFactory } from '@nestjs/core';
import { DataSource, IsNull } from 'typeorm';
import { AppModule } from './app.module';
import { Complexion, Profile } from './profiles/entities/profile.entity';
import { ProfilesService } from './profiles/profiles.service';

/**
 * Fills in what the registration rework added to profiles that predate it:
 *
 *  - `publicId`, the identifier shown wherever the real name is withheld. New
 *    profiles get one from ProfilesService at creation; rows older than that
 *    column have none, and the public profiles list has nothing to label them
 *    with until they do.
 *  - `complexion: 'medium'`, which the four-way bdmarriage scale replaced with
 *    'wheatish'. The old value stays in the enum purely so these rows load.
 *
 * Safe to re-run: rows that already have an id and a current complexion are
 * skipped, so a second run reports nothing to do.
 *
 *   npm run backfill:public-ids
 */
async function backfillPublicIds() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const profiles = app.get(DataSource).getRepository(Profile);
  const profilesService = app.get(ProfilesService);

  const missingIds = await profiles.find({ where: { publicId: IsNull() } });
  for (const profile of missingIds) {
    // Allocated and saved one at a time: generatePublicId checks the candidate
    // against rows already in the table, so a batch save would let two
    // profiles in the same batch collide on the unique index.
    profile.publicId = await profilesService.generatePublicId();
    await profiles.save(profile);
  }
  console.log(
    missingIds.length === 0
      ? 'Nothing to backfill — every profile already has a public id.'
      : `Assigned a public id to ${missingIds.length} profile(s).`,
  );

  const legacyComplexion = await profiles.find({
    where: { complexion: Complexion.MEDIUM },
  });
  if (legacyComplexion.length === 0) {
    console.log("Nothing to remap — no profile is still on complexion 'medium'.");
  } else {
    for (const profile of legacyComplexion) {
      profile.complexion = Complexion.WHEATISH;
    }
    await profiles.save(legacyComplexion);
    console.log(
      `Remapped ${legacyComplexion.length} profile(s) from complexion 'medium' to 'wheatish'.`,
    );
  }

  await app.close();
}

backfillPublicIds().catch((error) => {
  console.error(error);
  process.exit(1);
});
