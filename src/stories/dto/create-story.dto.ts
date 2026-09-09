import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { MediaType } from '@prisma/client';
import { StoryTextElementDto } from './story-text-element.dto';

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
] as const;

export class CreateStoryDto {
  @ApiProperty({ enum: MediaType })
  @IsIn(Object.values(MediaType))
  mediaType: MediaType;

  @ApiProperty({ enum: ALLOWED_CONTENT_TYPES })
  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType: (typeof ALLOWED_CONTENT_TYPES)[number];

  @ApiPropertyOptional({
    type: [StoryTextElementDto],
    description:
      'Positioned text/@mention overlays on top of the media, in normalized (0-1) coordinates',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => StoryTextElementDto)
  textElements?: StoryTextElementDto[];
}
