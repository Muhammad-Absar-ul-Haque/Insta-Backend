import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminStatsController } from './stats/admin-stats.controller';
import { AdminStatsService } from './stats/admin-stats.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';
import { AdminContentController } from './content/admin-content.controller';
import { AdminContentService } from './content/admin-content.service';
import { AdminReportsController } from './reports/admin-reports.controller';
import { AdminReportsService } from './reports/admin-reports.service';
import { AdminAuditLogController } from './audit-log/admin-audit-log.controller';
import { AdminHashtagsController } from './hashtags/admin-hashtags.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminAuthController,
    AdminStatsController,
    AdminUsersController,
    AdminContentController,
    AdminReportsController,
    AdminAuditLogController,
    AdminHashtagsController,
  ],
  providers: [
    AdminAuditService,
    AdminStatsService,
    AdminUsersService,
    AdminContentService,
    AdminReportsService,
  ],
})
export class AdminModule {}
