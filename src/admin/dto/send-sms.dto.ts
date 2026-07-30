import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString, Length } from 'class-validator';

export class SendSmsDto {
  @ApiProperty({ example: '+8801700000000' })
  @IsPhoneNumber('BD')
  phone: string;

  @ApiProperty({ example: 'Your appointment is confirmed for tomorrow.' })
  @IsString()
  @Length(1, 918)
  message: string;
}
