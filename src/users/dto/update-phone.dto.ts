import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber } from 'class-validator';

/**
 * Attaches a phone number to the signed-in account without an OTP round-trip.
 *
 * The SMS gateway is not live yet, so the registration wizard records the
 * number here and leaves `phoneVerifiedAt` unset — the column is what tells
 * the OTP flow, once it is switched back on, that this number still needs
 * verifying.
 */
export class UpdatePhoneDto {
  @ApiProperty({ example: '+8801700000000' })
  @IsPhoneNumber()
  phone: string;
}
