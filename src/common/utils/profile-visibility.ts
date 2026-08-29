import { User } from '../../users/entities/user.entity';
import { Photo } from '../../profiles/entities/photo.entity';
import { Profile } from '../../profiles/entities/profile.entity';
import { calculateAge } from './age';
import { lockedLocationFields, publicLocationFields } from './location-fields';

export type ProfileBearingUser = User & { profile: Profile };

/**
 * The one place that decides what a viewer may see about someone else.
 *
 * Unlocking a profile is a paid action, so what it buys has to be exact and it
 * has to be enforced on the server — hiding a field in the UI alone still ships
 * it in the JSON. Every endpoint that returns another member's profile goes
 * through these two functions rather than listing fields itself.
 *
 * Locked shows the whole bio-data — that is the shop window, and a member has
 * to be able to judge a match before paying. Withheld is everything that lets a
 * viewer reach or identify the person off-platform: their name, phone, email,
 * street address and home district. Division and country stay visible, so the
 * directory's filters still mean something without giving the person away.
 */
export function lockedProfileFields(target: ProfileBearingUser) {
  const { profile } = target;
  const primary = primaryPhoto(profile);

  return {
    userId: target.id,
    publicId: profile.publicId,
    age: calculateAge(target.dob),
    gender: target.gender,
    ...lockedLocationFields(profile),

    // Basic
    bio: profile.bio,
    religion: profile.religion,
    maritalStatus: profile.maritalStatus,
    profileCreatedBy: profile.profileCreatedBy,
    nationality: profile.nationality,

    // Education & career
    education: profile.education,
    educationDetails: profile.educationDetails,
    collegeUniversity: profile.collegeUniversity,
    profession: profile.profession,
    professionDetails: profile.professionDetails,
    workingSector: profile.workingSector,
    companyName: profile.companyName,
    // The member asked for the amount to stay private; the flag still ships so
    // the UI can say so rather than silently omitting the row.
    monthlyIncome: profile.incomeIsPrivate ? null : profile.monthlyIncome,
    incomeIsPrivate: profile.incomeIsPrivate,

    // Family
    fatherStatus: profile.fatherStatus,
    fatherOccupation: profile.fatherOccupation,
    motherStatus: profile.motherStatus,
    motherOccupation: profile.motherOccupation,
    siblingsCount: profile.siblingsCount,
    numberOfBrothers: profile.numberOfBrothers,
    numberOfSisters: profile.numberOfSisters,
    brothersMarried: profile.brothersMarried,
    brothersUnmarried: profile.brothersUnmarried,
    sistersMarried: profile.sistersMarried,
    sistersUnmarried: profile.sistersUnmarried,
    familyDetails: profile.familyDetails,
    familyFinancialStatus: profile.familyFinancialStatus,

    // Physical
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyType: profile.bodyType,
    complexion: profile.complexion,
    bloodGroup: profile.bloodGroup,
    physicalDetails: profile.physicalDetails,

    // Lifestyle
    religiousValue: profile.religiousValue,
    familyValues: profile.familyValues,
    diet: profile.diet,
    smoke: profile.smoke,
    hobbies: profile.hobbies,

    // Background & preferences
    motherTongue: profile.motherTongue,
    englishComfort: profile.englishComfort,
    residencyStatus: profile.residencyStatus,
    growUpIn: profile.growUpIn,
    partnerPreferences: profile.partnerPreferences,

    // The primary photo is the shop window — it stays clear so a viewer can
    // judge a match before paying. Every other photo stays blurred until
    // unlock. The "Likes You" paywall does not come through here (getLikesYou
    // does its own gating) and stays blurred regardless.
    photos: sortedPhotos(profile).map((photo) =>
      photo.id === primary?.id ? photo.url : photo.blurredUrl,
    ),
    isVerified: profile.isVerified,
    locked: true as const,
  };
}

/** Everything above, plus the identity and contact details unlocking pays for. */
export function unlockedProfileFields(target: ProfileBearingUser) {
  const { profile } = target;

  return {
    ...lockedProfileFields(target),
    // Restores the district that lockedLocationFields held back, alongside the
    // division and country it already carried.
    ...publicLocationFields(profile),
    name: profile.name,
    relativeName: profile.relativeName,
    relativePhone: profile.relativePhone,
    phone: target.phone,
    email: target.email,
    presentAddress: profile.presentAddress,
    permanentAddress: profile.permanentAddress,
    // The postcode is part of the address the unlock fee buys — it is withheld
    // from every locked view (see lockedLocationFields) but there is no reason
    // to hold it back from a viewer who has already paid for the addresses it
    // belongs to.
    zip: profile.zip,
    // An unlocked viewer paid for the amount; the private flag no longer applies.
    monthlyIncome: profile.monthlyIncome,
    photos: sortedPhotos(profile).map((photo) => photo.url),
    locked: false as const,
  };
}

/** The primary photo first, then the member's own ordering. */
export function primaryPhoto(profile: Profile): Photo | null {
  return (
    profile.photos?.find((photo) => photo.isPrimary) ??
    profile.photos?.[0] ??
    null
  );
}

function sortedPhotos(profile: Profile): Photo[] {
  return [...(profile.photos ?? [])].sort((a, b) => a.order - b.order);
}
