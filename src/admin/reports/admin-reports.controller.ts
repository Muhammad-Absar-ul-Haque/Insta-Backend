import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { AdminReportsService } from './admin-reports.service';
import { ListReportsQueryDto } from '../dto/list-reports-query.dto';
import { ResolveReportDto } from '../dto/resolve-report.dto';

@ApiTags('admin/reports')
@ApiBearerAuth()
@Roles(Role.admin, Role.moderator)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService) {}

  @Get()
  @ApiOperation({ summary: 'List reports, oldest-pending-first by default' })
  list(@Query() query: ListReportsQueryDto) {
    return this.adminReportsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a report' })
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminReportsService.getById(id);
  }

  @Patch(':id/resolve')
  @ApiOperation({
    summary: 'Resolve a report: dismiss, delete the content, ban, or warn',
  })
  resolve(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveReportDto,
  ) {
    return this.adminReportsService.resolve(admin.id, id, dto);
  }
}
