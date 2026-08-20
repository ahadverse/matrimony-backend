import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class SubmitManualBkashDto {
  @ApiProperty({ example: 500 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({
    example: 'AJ7B9K2XQ1',
    description: 'The bKash Transaction ID (TrxID) from the payment confirmation SMS',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9]{8,12}$/, {
    message: 'trxId must be the 8-12 character bKash Transaction ID',
  })
  trxId: string;

  @ApiProperty({ example: '01712345678' })
  @IsString()
  @Matches(/^(?:\+?880|0)1[3-9]\d{8}$/, {
    message:
      'payerAccountNumber must be a valid Bangladeshi mobile number, e.g. 01712345678',
  })
  payerAccountNumber: string;
}
