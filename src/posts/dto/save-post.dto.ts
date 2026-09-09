import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SavePostDto {
  @ApiPropertyOptional({
    description: 'Collection to save into, defaults to "All Posts"',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  collectionName?: string;
}
