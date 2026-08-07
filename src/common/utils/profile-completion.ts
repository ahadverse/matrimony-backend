import { Profile } from '../../profiles/entities/profile.entity';

export const MIN_BROWSE_COMPLETION_PERCENT = 80;

const COMPLETION_FIELDS: {
  key: string;
  isComplete: (profile: Profile) => boolean;
}[] = [
  { key: 'name', isComplete: (p) => !!p.name },
  { key: 'district', isComplete: (p) => !!p.district },
  { key: 'subDistrict', isComplete: (p) => !!p.subDistrict },
  { key: 'bio', isComplete: (p) => !!p.bio },
  { key: 'profession', isComplete: (p) => !!p.profession },
  { key: 'education', isComplete: (p) => !!p.education },
  { key: 'religion', isComplete: (p) => !!p.religion },
  { key: 'heightCm', isComplete: (p) => p.heightCm != null },
  { key: 'maritalStatus', isComplete: (p) => !!p.maritalStatus },
  { key: 'profileCreatedBy', isComplete: (p) => !!p.profileCreatedBy },
  { key: 'photo', isComplete: (p) => (p.photos?.length ?? 0) > 0 },
  { key: 'fatherOccupation', isComplete: (p) => !!p.fatherOccupation },
  { key: 'motherOccupation', isComplete: (p) => !!p.motherOccupation },
  { key: 'siblingsCount', isComplete: (p) => p.siblingsCount != null },
  { key: 'bloodGroup', isComplete: (p) => !!p.bloodGroup },
  { key: 'complexion', isComplete: (p) => !!p.complexion },
  { key: 'monthlyIncome', isComplete: (p) => p.monthlyIncome != null },
  { key: 'companyName', isComplete: (p) => !!p.companyName },
  { key: 'presentAddress', isComplete: (p) => !!p.presentAddress },
  { key: 'permanentAddress', isComplete: (p) => !!p.permanentAddress },
  { key: 'motherTongue', isComplete: (p) => !!p.motherTongue },
  { key: 'englishComfort', isComplete: (p) => !!p.englishComfort },
  { key: 'residencyStatus', isComplete: (p) => !!p.residencyStatus },
  { key: 'growUpIn', isComplete: (p) => !!p.growUpIn },
  { key: 'collegeUniversity', isComplete: (p) => !!p.collegeUniversity },
  { key: 'partnerPreferences', isComplete: (p) => !!p.partnerPreferences },
  { key: 'hobbies', isComplete: (p) => !!p.hobbies },
  {
    key: 'familyFinancialStatus',
    isComplete: (p) => !!p.familyFinancialStatus,
  },
  { key: 'bodyType', isComplete: (p) => !!p.bodyType },
  { key: 'numberOfSisters', isComplete: (p) => p.numberOfSisters != null },
  { key: 'numberOfBrothers', isComplete: (p) => p.numberOfBrothers != null },
];

export function calculateProfileCompletion(profile: Profile | null): {
  percent: number;
  missingFields: string[];
} {
  if (!profile) {
    return {
      percent: 0,
      missingFields: COMPLETION_FIELDS.map((f) => f.key),
    };
  }

  const missingFields = COMPLETION_FIELDS.filter(
    (f) => !f.isComplete(profile),
  ).map((f) => f.key);
  const percent = Math.round(
    ((COMPLETION_FIELDS.length - missingFields.length) /
      COMPLETION_FIELDS.length) *
      100,
  );

  return { percent, missingFields };
}
