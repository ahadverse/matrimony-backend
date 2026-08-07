import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BloodGroup, Complexion, MaritalStatus, ProfileCreatedBy } from '../entities/profile.entity';

export class UpsertProfileDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty()
  @IsString()
  district: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subDistrict?: string;

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

  @ApiProperty({ enum: MaritalStatus })
  @IsEnum(MaritalStatus)
  maritalStatus: MaritalStatus;

  @ApiProperty({ enum: ProfileCreatedBy, required: false })
  @IsOptional()
  @IsEnum(ProfileCreatedBy)
  profileCreatedBy?: ProfileCreatedBy;

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
}
