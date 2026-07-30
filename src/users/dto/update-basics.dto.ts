import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { Gender } from '../entities/user.entity';

export class UpdateBasicsDto {
  @ApiProperty({ enum: Gender, required: false })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ required: false, example: '1998-05-20' })
  @IsOptional()
  @IsDateString()
  dob?: string;
}
