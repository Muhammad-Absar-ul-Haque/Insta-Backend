import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdminActionType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';

export class ListAuditLogQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  adminId?: number;

  @ApiPropertyOptional({ enum: AdminActionType })
  @IsOptional()
  @IsEnum(AdminActionType)
  actionType?: AdminActionType;
}
