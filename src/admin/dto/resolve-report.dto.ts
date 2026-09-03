import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const RESOLUTION_ACTIONS = [
  'dismiss',
  'delete_content',
  'ban_user',
  'warn_user',
] as const;
export type ReportResolutionAction = (typeof RESOLUTION_ACTIONS)[number];

export class ResolveReportDto {
  @ApiProperty({ enum: RESOLUTION_ACTIONS })
  @IsIn(RESOLUTION_ACTIONS)
  action: ReportResolutionAction;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
