import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const MEDIA_TYPES = ['image', 'video'] as const;
export type MessageMediaType = (typeof MEDIA_TYPES)[number];

export class RequestMessageMediaUploadDto {
  @ApiProperty({ enum: MEDIA_TYPES })
  @IsIn(MEDIA_TYPES)
  mediaType: MessageMediaType;

  @ApiProperty({
    description:
      'Kept for documentation/validation of intent; Cloudinary auto-detects the real format',
  })
  @IsIn([
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm',
  ])
  contentType: string;
}
