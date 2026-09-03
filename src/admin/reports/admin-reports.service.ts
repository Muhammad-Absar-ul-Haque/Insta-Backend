import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminActionType,
  Prisma,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toCursorPage } from '../../common/utils/pagination.util';
import { USER_SUMMARY_SELECT } from '../../common/utils/user-summary.util';
import { AdminAuditService } from '../admin-audit.service';
import { ListReportsQueryDto } from '../dto/list-reports-query.dto';
import { ResolveReportDto } from '../dto/resolve-report.dto';

@Injectable()
export class AdminReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(query: ListReportsQueryDto) {
    const where: Prisma.ReportWhereInput = {
      status: query.status ?? ReportStatus.pending,
      ...(query.targetType ? { targetType: query.targetType } : {}),
    };

    const rows = await this.prisma.report.findMany({
      where,
      include: { reporter: { select: USER_SUMMARY_SELECT } },
      take: query.limit + 1,
      // Oldest-pending-first: the report that's been waiting longest surfaces first.
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });
    return toCursorPage(rows, query.limit);
  }

  async getById(id: number) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        reporter: { select: USER_SUMMARY_SELECT },
        reviewer: { select: USER_SUMMARY_SELECT },
      },
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    return report;
  }

  async resolve(adminId: number, reportId: number, dto: ResolveReportDto) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report || report.status !== ReportStatus.pending) {
      throw new NotFoundException('Pending report not found');
    }

    switch (dto.action) {
      case 'dismiss':
        await this.audit.log({
          adminId,
          actionType: AdminActionType.dismiss_report,
          targetType: 'report',
          targetId: reportId,
          notes: dto.notes,
        });
        break;
      case 'delete_content':
        await this.deleteContent(
          adminId,
          report.targetType,
          report.targetId,
          reportId,
          dto.notes,
        );
        break;
      case 'ban_user': {
        const ownerId = await this.resolveOwnerId(
          report.targetType,
          report.targetId,
        );
        await this.prisma.$transaction([
          this.prisma.user.update({
            where: { id: ownerId },
            data: { isBanned: true },
          }),
          this.prisma.refreshToken.updateMany({
            where: { userId: ownerId, revokedAt: null },
            data: { revokedAt: new Date() },
          }),
        ]);
        await this.audit.log({
          adminId,
          actionType: AdminActionType.ban_user,
          targetType: 'user',
          targetId: ownerId,
          notes: `${dto.notes ?? ''} (via report ${reportId})`.trim(),
        });
        break;
      }
      case 'warn_user': {
        const ownerId = await this.resolveOwnerId(
          report.targetType,
          report.targetId,
        );
        await this.audit.log({
          adminId,
          actionType: AdminActionType.warn_user,
          targetType: 'user',
          targetId: ownerId,
          notes: `${dto.notes ?? ''} (via report ${reportId})`.trim(),
        });
        break;
      }
    }

    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        status:
          dto.action === 'dismiss'
            ? ReportStatus.dismissed
            : ReportStatus.action_taken,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });
  }

  private async deleteContent(
    adminId: number,
    targetType: ReportTargetType,
    targetId: number,
    reportId: number,
    notes?: string,
  ): Promise<void> {
    const note = `${notes ?? ''} (via report ${reportId})`.trim();
    switch (targetType) {
      case ReportTargetType.post:
        await this.prisma.post.update({
          where: { id: targetId },
          data: { deletedAt: new Date() },
        });
        await this.audit.log({
          adminId,
          actionType: AdminActionType.delete_post,
          targetType: 'post',
          targetId,
          notes: note,
        });
        return;
      case ReportTargetType.comment: {
        const comment = await this.prisma.comment.findUniqueOrThrow({
          where: { id: targetId },
        });
        await this.prisma.$transaction([
          this.prisma.comment.update({
            where: { id: targetId },
            data: { deletedAt: new Date() },
          }),
          this.prisma.post.update({
            where: { id: comment.postId },
            data: { commentCount: { decrement: 1 } },
          }),
        ]);
        await this.audit.log({
          adminId,
          actionType: AdminActionType.delete_comment,
          targetType: 'comment',
          targetId,
          notes: note,
        });
        return;
      }
      case ReportTargetType.reel:
        await this.prisma.reel.update({
          where: { id: targetId },
          data: { deletedAt: new Date() },
        });
        await this.audit.log({
          adminId,
          actionType: AdminActionType.delete_reel,
          targetType: 'reel',
          targetId,
          notes: note,
        });
        return;
      case ReportTargetType.story:
        await this.prisma.story.update({
          where: { id: targetId },
          data: { isActive: false },
        });
        await this.audit.log({
          adminId,
          actionType: AdminActionType.delete_story,
          targetType: 'story',
          targetId,
          notes: note,
        });
        return;
      case ReportTargetType.user:
        throw new BadRequestException(
          'Use the ban_user action for user reports, not delete_content',
        );
    }
  }

  private async resolveOwnerId(
    targetType: ReportTargetType,
    targetId: number,
  ): Promise<number> {
    switch (targetType) {
      case ReportTargetType.user:
        return targetId;
      case ReportTargetType.post:
        return (
          await this.prisma.post.findUniqueOrThrow({ where: { id: targetId } })
        ).userId;
      case ReportTargetType.comment:
        return (
          await this.prisma.comment.findUniqueOrThrow({
            where: { id: targetId },
          })
        ).userId;
      case ReportTargetType.reel:
        return (
          await this.prisma.reel.findUniqueOrThrow({ where: { id: targetId } })
        ).userId;
      case ReportTargetType.story:
        return (
          await this.prisma.story.findUniqueOrThrow({ where: { id: targetId } })
        ).userId;
    }
  }
}
