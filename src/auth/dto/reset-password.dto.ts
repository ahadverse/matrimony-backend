import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: '+8801700000000' })
  @IsPhoneNumber('BD')
  phone: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;

  @ApiProperty({
    description: 'Token returned by /auth/otp/verify for purpose=reset',
  })
  @IsString()
  verificationToken: string;
}
