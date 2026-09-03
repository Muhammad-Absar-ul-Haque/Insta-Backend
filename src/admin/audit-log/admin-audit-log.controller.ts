import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma, Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildCursorArgs,
  toCursorPage,
} from '../../common/utils/pagination.util';
import { USER_SUMMARY_SELECT } from '../../common/utils/user-summary.util';
import { ListAuditLogQueryDto } from '../dto/list-audit-log-query.dto';

@ApiTags('admin/audit-log')
@ApiBearerAuth()
@Roles(Role.admin, Role.moderator)
@Controller('admin/audit-log')
export class AdminAuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary:
      'Paginated log of every admin/moderator action, filterable by admin or action type',
  })
  async list(@Query() query: ListAuditLogQueryDto) {
    const where: Prisma.AdminActionWhereInput = {
      ...(query.adminId ? { adminId: query.adminId } : {}),
      ...(query.actionType ? { actionType: query.actionType } : {}),
    };

    const rows = await this.prisma.adminAction.findMany({
      where,
      include: { admin: { select: USER_SUMMARY_SELECT } },
      ...buildCursorArgs(query),
    });
    return toCursorPage(rows, query.limit);
  }
}
