import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { MediaType } from '@prisma/client';

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
}
