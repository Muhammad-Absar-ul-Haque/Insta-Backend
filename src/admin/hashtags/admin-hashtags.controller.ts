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
import { PrismaService } from '../../prisma/prisma.service';
import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { toCursorPage } from '../../common/utils/pagination.util';
import { AdminAuditService } from '../admin-audit.service';
import { AdminNotesDto } from '../dto/admin-notes.dto';

@ApiTags('admin/hashtags')
@ApiBearerAuth()
@Roles(Role.admin, Role.moderator)
@Controller('admin/hashtags')
export class AdminHashtagsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List hashtags ranked by post count, to spot trending/spammy tags',
  })
  async list(@Query() query: CursorPaginationDto) {
    const rows = await this.prisma.hashtag.findMany({
      take: query.limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: [{ postCount: 'desc' }, { id: 'desc' }],
    });
    return toCursorPage(rows, query.limit);
  }

  @Patch(':id/block')
  @ApiOperation({
    summary: 'Hide a hashtag from search/explore without deleting its posts',
  })
  async block(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminNotesDto,
  ) {
    const hashtag = await this.prisma.hashtag.update({
      where: { id },
      data: { isBlocked: true },
    });
    await this.audit.log({
      adminId: admin.id,
      actionType: 'block_hashtag',
      targetType: 'hashtag',
      targetId: id,
      notes: dto.notes,
    });
    return hashtag;
  }
}
