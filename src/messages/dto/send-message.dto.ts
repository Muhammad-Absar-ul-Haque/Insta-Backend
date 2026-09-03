import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '@prisma/client';
import { IsIn, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ enum: MessageType })
  @IsIn(Object.values(MessageType))
  messageType: MessageType;

  @ApiPropertyOptional({
    description: 'Text body for `text`, or the shared post id for `post_share`',
  })
  @ValidateIf((dto: SendMessageDto) => dto.messageType !== MessageType.image)
  @IsString()
  @MaxLength(2200)
  content?: string;

  @ApiPropertyOptional({ description: 'Required for `image` messages' })
  @ValidateIf((dto: SendMessageDto) => dto.messageType === MessageType.image)
  @IsUrl({ require_tld: false })
  mediaUrl?: string;
}
