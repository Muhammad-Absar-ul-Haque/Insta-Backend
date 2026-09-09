import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';

export class ListSavedQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Filter to a single collection name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  collection?: string;
}
