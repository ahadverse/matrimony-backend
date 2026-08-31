import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AssistantRequestPlan } from '../entities/assistant-request.entity';

export class CreateAssistantRequestDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  phone: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  profileId?: string;

  // Optional on purpose: the landing page lets a visitor scroll straight past
  // the pricing cards to the form, and a lead with no plan still has to submit.
  @ApiProperty({ enum: AssistantRequestPlan, required: false })
  @IsOptional()
  @IsEnum(AssistantRequestPlan)
  plan?: AssistantRequestPlan;
}
