import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ maxLength: 2200 })
  @IsString()
  @MinLength(1)
  @MaxLength(2200)
  content: string;
}
