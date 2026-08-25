import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'ziaul@example.com',
    description: 'Either the account email or the account phone number',
  })
  @IsString()
  identifier: string;

  @ApiProperty()
  @IsString()
  password: string;
}
