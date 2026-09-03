import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SavePostDto {
  @ApiPropertyOptional({ default: 'All Posts' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  collectionName?: string;
}
