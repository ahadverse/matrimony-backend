import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class OAuthExchangeDto {
  @ApiProperty({
    description:
      'One-time code returned in the redirect from /auth/google/callback or /auth/facebook/callback',
  })
  @IsString()
  code: string;
}
