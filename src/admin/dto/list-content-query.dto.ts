import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';

const SORT_OPTIONS = ['newest', 'most_liked'] as const;

export class ListContentQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Filter to a single author' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({ enum: SORT_OPTIONS, default: 'newest' })
  @IsOptional()
  @IsIn(SORT_OPTIONS)
  sort?: (typeof SORT_OPTIONS)[number];
}
