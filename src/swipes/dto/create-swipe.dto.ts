import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { SwipeAction } from '../entities/swipe.entity';

export class CreateSwipeDto {
  @ApiProperty()
  @IsUUID()
  targetId: string;

  @ApiProperty({ enum: SwipeAction })
  @IsEnum(SwipeAction)
  action: SwipeAction;
}
