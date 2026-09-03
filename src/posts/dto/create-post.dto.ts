import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MediaType } from '@prisma/client';

export const ALLOWED_MEDIA_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

export class PostMediaInputDto {
  @ApiProperty({ enum: MediaType })
  @IsIn(Object.values(MediaType))
  mediaType: MediaType;

  @ApiProperty({ enum: ALLOWED_MEDIA_CONTENT_TYPES })
  @IsIn(ALLOWED_MEDIA_CONTENT_TYPES)
  contentType: (typeof ALLOWED_MEDIA_CONTENT_TYPES)[number];
}

export class CreatePostDto {
  @ApiPropertyOptional({ maxLength: 2200 })
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @ApiProperty({ type: [PostMediaInputDto], minItems: 1, maxItems: 10 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PostMediaInputDto)
  media: PostMediaInputDto[];
}
