import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsPhoneNumber } from 'class-validator';
import { OtpPurpose } from '../entities/otp-verification.entity';

export class SendOtpDto {
  @ApiProperty({ example: '+8801700000000' })
  @IsPhoneNumber()
  phone: string;

  @ApiProperty({ enum: OtpPurpose })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}
