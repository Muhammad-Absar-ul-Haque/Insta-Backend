import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminStatsService } from './admin-stats.service';
import { StatsRangeDto } from './admin-stats.dto';

// Admin-only: dashboard analytics (and anything revenue-adjacent later) stay out of
// moderators' hands per the spec's permission-matrix note.
@ApiTags('admin/stats')
@ApiBearerAuth()
@Roles(Role.admin)
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Total users/posts, DAU/MAU approximation, recent signups',
  })
  overview() {
    return this.adminStatsService.overview();
  }

  @Get('growth')
  @ApiOperation({ summary: 'Signups per day for charting' })
  growth(@Query() query: StatsRangeDto) {
    return this.adminStatsService.growth(query.days);
  }

  @Get('engagement')
  @ApiOperation({ summary: 'Likes/comments/posts per day' })
  engagement(@Query() query: StatsRangeDto) {
    return this.adminStatsService.engagement(query.days);
  }
}
