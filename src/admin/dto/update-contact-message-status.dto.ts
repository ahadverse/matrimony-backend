import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ContactMessageStatus } from '../../contact-messages/entities/contact-message.entity';

export class UpdateContactMessageStatusDto {
  @ApiProperty({ enum: ContactMessageStatus })
  @IsEnum(ContactMessageStatus)
  status: ContactMessageStatus;
}
