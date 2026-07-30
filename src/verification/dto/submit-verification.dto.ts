import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class SubmitVerificationDto {
  @ApiProperty({ example: '1234567890123' })
  @Matches(/^\d{10}$|^\d{13}$|^\d{17}$/, {
    message: 'NID number must be a valid 10, 13, or 17 digit number',
  })
  nidNumber: string;
}
