import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Gender } from '../../users/entities/user.entity';

export class RegisterDto {
  @ApiProperty({ example: 'ziaul@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  // Gender and date of birth are collected on the wizard's Basic Info step,
  // which runs after the account exists, so neither is required to register.
  // Both are then written through PATCH /users/me/basics.
  @ApiProperty({ enum: Gender, required: false })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ required: false, example: '1998-05-20' })
  @IsOptional()
  @IsDateString()
  dob?: string;
}
