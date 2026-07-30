import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import sharp from 'sharp';
import { AppModule } from './app.module';
import {
  User,
  UserRole,
  Gender,
  UserStatus,
} from './users/entities/user.entity';
import {
  Profile,
  ApprovalStatus,
  MaritalStatus,
} from './profiles/entities/profile.entity';
import { Photo } from './profiles/entities/photo.entity';
import { AppSettings } from './admin/entities/app-settings.entity';

const SAMPLE_PASSWORD = 'Passw0rd!';
const ADMIN_PASSWORD = 'Admin@12345';

/**
 * Free demo headshots from i.pravatar.cc (real 500x500 photos, unlike
 * randomuser.me's 128x128 portraits which look pixelated once stretched
 * across a full-width swipe card). pravatar has no gender metadata, so
 * these ids were picked by hand from its fixed image set to keep
 * female/male sample profiles looking correct.
 *
 * The blurred variant is generated locally with sharp (same blur params
 * as the real upload pipeline in photo-storage.service.ts) and stored as
 * a data URI, since the usual images.weserv.nl resize proxy blocks
 * pravatar.cc by policy and there's no S3 bucket for seed data to live in.
 */
const FEMALE_PRAVATAR_IDS = [5, 9, 10, 16, 20, 21, 23, 26, 28];
const MALE_PRAVATAR_IDS = [8, 11, 12, 13, 14, 18, 51, 59, 60];

const BLUR_SIGMA = 25;
const BLUR_MAX_WIDTH = 200;

// Only 9 distinct pravatar ids exist per gender, so with 50+ profiles per
// gender many indices reuse the same source image — cache the fetch+blur
// result per id instead of redoing the network round-trip and sharp pass
// for every profile that lands on the same photo.
const photoCache = new Map<string, { url: string; blurredUrl: string }>();

async function samplePhotoUrls(gender: Gender, genderIndex: number) {
  const ids = gender === Gender.FEMALE ? FEMALE_PRAVATAR_IDS : MALE_PRAVATAR_IDS;
  const id = ids[genderIndex % ids.length];
  const cacheKey = `${gender}-${id}`;
  const cached = photoCache.get(cacheKey);
  if (cached) return cached;

  const url = `https://i.pravatar.cc/500?img=${id}`;
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  const blurred = await sharp(buffer)
    .resize({ width: BLUR_MAX_WIDTH })
    .blur(BLUR_SIGMA)
    .webp({ quality: 60 })
    .toBuffer();
  const blurredUrl = `data:image/webp;base64,${blurred.toString('base64')}`;

  const result = { url, blurredUrl };
  photoCache.set(cacheKey, result);
  return result;
}

interface SampleProfile {
  phone: string;
  gender: Gender;
  name: string;
  district: string;
  lat: number;
  lon: number;
  profession: string;
  education?: string;
  religion?: string;
  maritalStatus?: MaritalStatus;
  heightCm?: number;
  bio?: string;
}

const handWrittenProfiles: SampleProfile[] = [
  {
    phone: '+8801711111111',
    gender: Gender.FEMALE,
    name: 'Ayesha Rahman',
    district: 'Dhaka',
    lat: 23.8103,
    lon: 90.4125,
    profession: 'Doctor',
  },
  {
    phone: '+8801711111112',
    gender: Gender.FEMALE,
    name: 'Nusrat Jahan',
    district: 'Gazipur',
    lat: 23.9999,
    lon: 90.4203,
    profession: 'Teacher',
  },
  {
    phone: '+8801711111113',
    gender: Gender.FEMALE,
    name: 'Farzana Akter',
    district: 'Chattogram',
    lat: 22.3569,
    lon: 91.7832,
    profession: 'Engineer',
  },
  {
    phone: '+8801711111114',
    gender: Gender.FEMALE,
    name: 'Tasnim Akter',
    district: 'Khulna',
    lat: 22.8456,
    lon: 89.5403,
    profession: 'Architect',
  },
  {
    phone: '+8801711111115',
    gender: Gender.FEMALE,
    name: 'Sadia Islam',
    district: 'Rajshahi',
    lat: 24.3745,
    lon: 88.6042,
    profession: 'Pharmacist',
  },
  {
    phone: '+8801711111116',
    gender: Gender.FEMALE,
    name: 'Rumana Haque',
    district: 'Sylhet',
    lat: 24.8949,
    lon: 91.8687,
    profession: 'Lawyer',
  },
  {
    phone: '+8801711111117',
    gender: Gender.FEMALE,
    name: 'Mahmuda Begum',
    district: 'Barishal',
    lat: 22.701,
    lon: 90.3535,
    profession: 'Nurse',
  },
  {
    phone: '+8801711111118',
    gender: Gender.FEMALE,
    name: 'Sharmin Sultana',
    district: 'Comilla',
    lat: 23.4607,
    lon: 91.1809,
    profession: 'Graphic Designer',
  },
  {
    phone: '+8801711111119',
    gender: Gender.FEMALE,
    name: 'Israt Jahan',
    district: "Cox's Bazar",
    lat: 21.4272,
    lon: 92.0058,
    profession: 'Marketing Executive',
  },
  {
    phone: '+8801722222221',
    gender: Gender.MALE,
    name: 'Tanvir Ahmed',
    district: 'Dhaka',
    lat: 23.7806,
    lon: 90.4193,
    profession: 'Software Engineer',
  },
  {
    phone: '+8801722222222',
    gender: Gender.MALE,
    name: 'Rakibul Islam',
    district: 'Narayanganj',
    lat: 23.6238,
    lon: 90.5,
    profession: 'Businessman',
  },
  {
    phone: '+8801722222223',
    gender: Gender.MALE,
    name: 'Shakil Hossain',
    district: 'Sylhet',
    lat: 24.8949,
    lon: 91.8687,
    profession: 'Banker',
  },
  {
    phone: '+8801722222224',
    gender: Gender.MALE,
    name: 'Arif Chowdhury',
    district: 'Khulna',
    lat: 22.8456,
    lon: 89.5403,
    profession: 'Civil Engineer',
  },
  {
    phone: '+8801722222225',
    gender: Gender.MALE,
    name: 'Mehedi Hasan',
    district: 'Rajshahi',
    lat: 24.3745,
    lon: 88.6042,
    profession: 'Accountant',
  },
  {
    phone: '+8801722222226',
    gender: Gender.MALE,
    name: 'Imran Kabir',
    district: 'Barishal',
    lat: 22.701,
    lon: 90.3535,
    profession: 'Doctor',
  },
  {
    phone: '+8801722222227',
    gender: Gender.MALE,
    name: 'Nayeem Islam',
    district: 'Mymensingh',
    lat: 24.7471,
    lon: 90.4203,
    profession: 'Entrepreneur',
  },
  {
    phone: '+8801722222228',
    gender: Gender.MALE,
    name: 'Foysal Ahmed',
    district: 'Comilla',
    lat: 23.4607,
    lon: 91.1809,
    profession: 'Architect',
  },
  {
    phone: '+8801722222229',
    gender: Gender.MALE,
    name: 'Kamrul Hasan',
    district: "Cox's Bazar",
    lat: 21.4272,
    lon: 92.0058,
    profession: 'Pilot',
  },
];

// Beyond the 18 hand-written profiles above (kept for their fixed,
// documented phone numbers), generate enough additional profiles to give
// Browse/filtering something realistic to work with — 50+ per gender.
const DISTRICT_COORDS = [
  { district: 'Dhaka', lat: 23.8103, lon: 90.4125 },
  { district: 'Gazipur', lat: 23.9999, lon: 90.4203 },
  { district: 'Chattogram', lat: 22.3569, lon: 91.7832 },
  { district: 'Khulna', lat: 22.8456, lon: 89.5403 },
  { district: 'Rajshahi', lat: 24.3745, lon: 88.6042 },
  { district: 'Sylhet', lat: 24.8949, lon: 91.8687 },
  { district: 'Barishal', lat: 22.701, lon: 90.3535 },
  { district: 'Comilla', lat: 23.4607, lon: 91.1809 },
  { district: "Cox's Bazar", lat: 21.4272, lon: 92.0058 },
  { district: 'Mymensingh', lat: 24.7471, lon: 90.4203 },
  { district: 'Narayanganj', lat: 23.6238, lon: 90.5 },
  { district: 'Rangpur', lat: 25.7439, lon: 89.2752 },
  { district: 'Bogura', lat: 24.8465, lon: 89.3775 },
  { district: 'Dinajpur', lat: 25.6217, lon: 88.6354 },
  { district: 'Jessore', lat: 23.1667, lon: 89.2167 },
  { district: 'Faridpur', lat: 23.607, lon: 89.8429 },
  { district: 'Tangail', lat: 24.2513, lon: 89.9167 },
  { district: 'Noakhali', lat: 22.8696, lon: 91.0995 },
  { district: 'Feni', lat: 23.0159, lon: 91.3976 },
  { district: 'Narsingdi', lat: 23.9322, lon: 90.715 },
] as const;

const FEMALE_FIRST_NAMES = [
  'Fatima', 'Sumaiya', 'Nadia', 'Taslima', 'Munira', 'Rehana', 'Shirin', 'Lubna', 'Shabnam',
  'Rownak', 'Afsana', 'Popy', 'Ruma', 'Shathi', 'Moushumi', 'Jesmin', 'Kanta', 'Ritu', 'Nasrin',
  'Sharmila', 'Hasina', 'Parvin', 'Salma', 'Kamrun', 'Yasmin', 'Rupa', 'Anika', 'Tania', 'Nazia',
  'Sabrina', 'Farhana', 'Suraiya', 'Chumki', 'Momtaz', 'Rozina', 'Laila', 'Mitu', 'Papia', 'Ishrat',
  'Nusaiba',
];

const MALE_FIRST_NAMES = [
  'Abdul', 'Mohammad', 'Sohel', 'Jahangir', 'Mizanur', 'Delwar', 'Aminul', 'Habibur', 'Shahin',
  'Faruk', 'Rezaul', 'Shafiqul', 'Mostafa', 'Alamgir', 'Anisur', 'Zahid', 'Rashed', 'Zakir', 'Firoz',
  'Kamal', 'Nazrul', 'Saiful', 'Iqbal', 'Masud', 'Golam', 'Rafiqul', 'Ashraful', 'Selim', 'Jamal',
  'Liton', 'Babul', 'Manik', 'Ripon', 'Milon', 'Bappy', 'Sujon', 'Emran', 'Rana', 'Tarek', 'Hridoy',
];

const LAST_NAMES = [
  'Rahman', 'Islam', 'Ahmed', 'Hossain', 'Khan', 'Chowdhury', 'Akhtar', 'Uddin', 'Mia', 'Sarker',
  'Talukder', 'Molla', 'Sikder', 'Bhuiyan', 'Mridha', 'Munshi', 'Pramanik', 'Biswas', 'Ali', 'Haque',
] as const;

const PROFESSIONS = [
  'Doctor', 'Teacher', 'Engineer', 'Architect', 'Pharmacist', 'Lawyer', 'Nurse', 'Graphic Designer',
  'Marketing Executive', 'Software Engineer', 'Businessman', 'Banker', 'Civil Engineer', 'Accountant',
  'Entrepreneur', 'Pilot', 'Government Officer', 'University Lecturer', 'Journalist', 'Homemaker',
  'Student', 'Police Officer', 'Army Officer', 'Dentist', 'Data Analyst',
] as const;

const EDUCATIONS = ['SSC', 'HSC', 'Diploma', "Bachelor's", "Master's", 'PhD'] as const;
// Weighted toward Islam to roughly reflect Bangladesh's religious makeup.
const RELIGIONS = ['Islam', 'Islam', 'Islam', 'Hinduism', 'Christianity', 'Buddhism'] as const;
const MARITAL_STATUSES = [
  MaritalStatus.SINGLE,
  MaritalStatus.SINGLE,
  MaritalStatus.SINGLE,
  MaritalStatus.SINGLE,
  MaritalStatus.DIVORCED,
  MaritalStatus.WIDOWED,
] as const;

function generateProfiles(gender: Gender, count: number, phonePrefix: string): SampleProfile[] {
  const firstNames = gender === Gender.FEMALE ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
  const profiles: SampleProfile[] = [];

  for (let i = 0; i < count; i++) {
    const first = firstNames[i % firstNames.length];
    const last = LAST_NAMES[(i * 7 + 3) % LAST_NAMES.length];
    const { district, lat, lon } = DISTRICT_COORDS[i % DISTRICT_COORDS.length];
    const profession = PROFESSIONS[i % PROFESSIONS.length];
    // Small deterministic jitter so profiles in the same district aren't
    // stacked on the exact same coordinate.
    const jitter = ((i % 7) - 3) * 0.01;

    profiles.push({
      phone: `${phonePrefix}${String(i + 1).padStart(7, '0')}`,
      gender,
      name: `${first} ${last}`,
      district,
      lat: lat + jitter,
      lon: lon - jitter,
      profession,
      education: EDUCATIONS[i % EDUCATIONS.length],
      religion: RELIGIONS[i % RELIGIONS.length],
      maritalStatus: MARITAL_STATUSES[i % MARITAL_STATUSES.length],
      heightCm: gender === Gender.FEMALE ? 150 + (i % 20) : 160 + (i % 25),
      bio: `${first} is a ${profession.toLowerCase()} from ${district}, looking for a genuine, family-oriented match.`,
    });
  }

  return profiles;
}

const GENERATED_PER_GENDER = 41; // 18 hand-written (9F/9M) + 41 generated each = 50 per gender

const sampleProfiles: SampleProfile[] = [
  ...handWrittenProfiles,
  ...generateProfiles(Gender.FEMALE, GENERATED_PER_GENDER, '+880175'),
  ...generateProfiles(Gender.MALE, GENERATED_PER_GENDER, '+880176'),
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  const users = dataSource.getRepository(User);
  const profiles = dataSource.getRepository(Profile);
  const photos = dataSource.getRepository(Photo);
  const settings = dataSource.getRepository(AppSettings);

  if ((await settings.count()) === 0) {
    await settings.save(settings.create({}));
    console.log(
      'Created default AppSettings (profileViewCost=200, minTopupAmount=500)',
    );
  }

  const adminPhone = '+8801700000000';
  const existingAdmin = await users.findOne({ where: { phone: adminPhone } });
  if (!existingAdmin) {
    await users.save(
      users.create({
        phone: adminPhone,
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        gender: Gender.MALE,
        role: UserRole.ADMIN,
        phoneVerifiedAt: new Date(),
      }),
    );
    console.log(
      `Created admin user ${adminPhone} / password ${ADMIN_PASSWORD}`,
    );
  }

  const genderPhotoCounters: Record<Gender, number> = {
    [Gender.FEMALE]: 0,
    [Gender.MALE]: 0,
  };

  for (const sample of sampleProfiles) {
    let user = await users.findOne({ where: { phone: sample.phone } });
    let savedProfile: Profile | null = user
      ? await profiles.findOne({ where: { userId: user.id } })
      : null;

    if (!user) {
      user = await users.save(
        users.create({
          phone: sample.phone,
          passwordHash: await bcrypt.hash(SAMPLE_PASSWORD, 10),
          gender: sample.gender,
          dob: '1998-01-01',
          phoneVerifiedAt: new Date(),
          latitude: sample.lat,
          longitude: sample.lon,
          status: UserStatus.ACTIVE,
        }),
      );

      const isDemoVerified =
        sample.phone === '+8801711111111' || sample.phone === '+8801722222221';

      savedProfile = await profiles.save(
        profiles.create({
          userId: user.id,
          name: sample.name,
          district: sample.district,
          profession: sample.profession,
          education: sample.education,
          religion: sample.religion,
          maritalStatus: sample.maritalStatus ?? MaritalStatus.SINGLE,
          heightCm: sample.heightCm,
          bio: sample.bio,
          approvalStatus: ApprovalStatus.APPROVED,
          approvedAt: new Date(),
          isVerified: isDemoVerified,
          verifiedAt: isDemoVerified ? new Date() : null,
        }),
      );
      console.log(
        `Created sample user ${sample.name} (${sample.phone}) / password ${SAMPLE_PASSWORD}`,
      );
    }

    const genderIndex = genderPhotoCounters[sample.gender]++;

    if (savedProfile) {
      const hasPhoto = (await photos.count({ where: { profileId: savedProfile.id } })) > 0;
      if (!hasPhoto) {
        const { url, blurredUrl } = await samplePhotoUrls(sample.gender, genderIndex);
        await photos.save(
          photos.create({
            profileId: savedProfile.id,
            url,
            blurredUrl,
            isPrimary: true,
            order: 0,
          }),
        );
        console.log(`Added demo photo for ${sample.name}`);
      }
    }
  }

  await app.close();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
