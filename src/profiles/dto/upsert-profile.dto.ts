import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  BloodGroup,
  Complexion,
  Diet,
  FamilyValues,
  MaritalStatus,
  ParentStatus,
  ProfileCreatedBy,
  Smoke,
} from '../entities/profile.entity';

/**
 * Every field is optional because this backs a partial upsert: the registration
 * wizard PUTs one step's slice at a time, and `ProfilesService.upsertMyProfile`
 * only writes keys that are actually present. `name` is still required to
 * *create* a profile — that check lives in the service, which is the only place
 * that knows whether a row already exists.
 */
export class UpsertProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiProperty({
    required: false,
    description:
      'Legacy Bangladesh-only field. Clients that send `country` should omit this — it is derived from `state`.',
  })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({
    required: false,
    description: 'Legacy Bangladesh-only field, derived from `city`.',
  })
  @IsOptional()
  @IsString()
  subDistrict?: string;

  @ApiProperty({ required: false, example: 'Bangladesh' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiProperty({ required: false, example: 'BD', description: 'ISO 3166-1 alpha-2' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiProperty({ required: false, example: 'Dhaka' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiProperty({ required: false, example: 'Savar' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiProperty({ required: false, example: '1340' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  zip?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profession?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  education?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  religion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(120)
  @Max(220)
  heightCm?: number;

  @ApiProperty({ enum: MaritalStatus, required: false })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiProperty({ enum: ProfileCreatedBy, required: false })
  @IsOptional()
  @IsEnum(ProfileCreatedBy)
  profileCreatedBy?: ProfileCreatedBy;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  relativeName?: string;

  @ApiProperty({ required: false, example: 'Bangladeshi' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  educationDetails?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  workingSector?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  professionDetails?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  incomeIsPrivate?: boolean;

  @ApiProperty({ enum: ParentStatus, required: false })
  @IsOptional()
  @IsEnum(ParentStatus)
  fatherStatus?: ParentStatus;

  @ApiProperty({ enum: ParentStatus, required: false })
  @IsOptional()
  @IsEnum(ParentStatus)
  motherStatus?: ParentStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fatherOccupation?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  motherOccupation?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  siblingsCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  brothersMarried?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  brothersUnmarried?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  sistersMarried?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  sistersUnmarried?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  familyDetails?: string;

  @ApiProperty({ enum: BloodGroup, required: false })
  @IsOptional()
  @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup;

  @ApiProperty({ enum: Complexion, required: false })
  @IsOptional()
  @IsEnum(Complexion)
  complexion?: Complexion;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  monthlyIncome?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  presentAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  permanentAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  motherTongue?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  englishComfort?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  residencyStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  growUpIn?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  collegeUniversity?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  partnerPreferences?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  hobbies?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  familyFinancialStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bodyType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  numberOfSisters?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  numberOfBrothers?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(250)
  weightKg?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  physicalDetails?: string;

  @ApiProperty({ required: false, example: 'Average religious' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  religiousValue?: string;

  @ApiProperty({ enum: FamilyValues, required: false })
  @IsOptional()
  @IsEnum(FamilyValues)
  familyValues?: FamilyValues;

  @ApiProperty({ enum: Diet, required: false })
  @IsOptional()
  @IsEnum(Diet)
  diet?: Diet;

  @ApiProperty({ enum: Smoke, required: false })
  @IsOptional()
  @IsEnum(Smoke)
  smoke?: Smoke;
}
