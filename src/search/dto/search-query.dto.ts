import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({
    description: 'Search term, matched against usernames, names and hashtags',
  })
  @IsString()
  @MinLength(1)
  q: string;
}
