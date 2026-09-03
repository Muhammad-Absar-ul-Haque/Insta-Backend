import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({
    type: [Number],
    description: 'User ids to start a conversation with (excluding yourself)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(49)
  @ArrayUnique()
  @IsInt({ each: true })
  participantIds: number[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isGroup?: boolean;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  groupName?: string;
}
