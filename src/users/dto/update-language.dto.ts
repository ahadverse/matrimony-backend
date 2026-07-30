import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateLanguageDto {
  @ApiProperty({ enum: ['en', 'bn'] })
  @IsIn(['en', 'bn'])
  languagePref: 'en' | 'bn';
}
