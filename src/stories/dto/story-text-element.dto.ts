import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsHexColor,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const ELEMENT_TYPES = ['text', 'mention'] as const;
export type StoryTextElementType = (typeof ELEMENT_TYPES)[number];

export class StoryTextElementDto {
  @ApiProperty({ enum: ELEMENT_TYPES })
  @IsIn(ELEMENT_TYPES)
  type: StoryTextElementType;

  @ApiProperty({
    description:
      'Free text for type "text"; the tagged username (no "@") for type "mention" — a username that doesn\'t resolve to a real account is silently dropped rather than rejected, same as an @mention typo in a comment',
    maxLength: 150,
  })
  @IsString()
  @MaxLength(150)
  content: string;

  @ApiProperty({
    description: 'Normalized horizontal position, 0-1',
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  x: number;

  @ApiProperty({
    description: 'Normalized vertical position, 0-1',
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  y: number;

  @ApiPropertyOptional({ minimum: 8, maximum: 96 })
  @IsOptional()
  @IsNumber()
  @Min(8)
  @Max(96)
  fontSize?: number;

  @ApiPropertyOptional({ description: 'Hex color, e.g. "#ffffff"' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ description: 'Degrees', minimum: -180, maximum: 180 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  rotation?: number;
}
