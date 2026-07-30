import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsPhoneNumber, Length } from 'class-validator';
import { OtpPurpose } from '../entities/otp-verification.entity';

export class VerifyOtpDto {
  @ApiProperty({ example: '+8801700000000' })
  @IsPhoneNumber('BD')
  phone: string;

  @ApiProperty({ example: '123456' })
  @Length(6, 6)
  code: string;

  @ApiProperty({ enum: OtpPurpose })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}
