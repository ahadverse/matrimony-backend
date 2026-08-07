import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AssistantRequestStatus } from '../../assistant-requests/entities/assistant-request.entity';

export class UpdateAssistantRequestStatusDto {
  @ApiProperty({ enum: AssistantRequestStatus })
  @IsEnum(AssistantRequestStatus)
  status: AssistantRequestStatus;
}
