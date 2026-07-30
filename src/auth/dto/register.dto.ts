import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';
import { Gender } from '../../users/entities/user.entity';

export class RegisterDto {
  @ApiProperty({ example: '+8801700000000' })
  @IsPhoneNumber('BD')
  phone: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ example: '1998-05-20' })
  @IsDateString()
  dob: string;

  @ApiProperty({
    description: 'Token returned by /auth/otp/verify for purpose=register',
  })
  @IsString()
  verificationToken: string;
}
