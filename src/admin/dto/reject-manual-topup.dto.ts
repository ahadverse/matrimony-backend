import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RejectManualTopupDto {
  @ApiProperty({
    example: 'Transaction ID does not match any received payment',
  })
  @IsString()
  @MinLength(3)
  reason: string;
}
