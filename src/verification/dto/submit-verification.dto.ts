import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/**
 * Bangladesh has issued NID numbers in several lengths over the years — the
 * 10-digit Smart Card (NID Card) number, the 13-digit form, and the 17-digit
 * form that prefixes the birth year. Pinning the check to exactly those three
 * rejected real cards that fall outside them, so the range is what is enforced;
 * an admin reviews the card against the selfie anyway.
 */
export class SubmitVerificationDto {
  @ApiProperty({ example: '1234567890123' })
  @Matches(/^\d{10,17}$/, {
    message: 'NID number must be between 10 and 17 digits',
  })
  nidNumber: string;
}
