import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class MuteUserDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  mutePosts?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  muteStories?: boolean;
}
