import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ReportTargetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NAMES } from '../jobs/queue.constants';
import { ReportEscalationJobData } from '../jobs/processors/report-escalation.processor';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.REPORT_ESCALATION)
    private readonly escalationQueue: Queue<ReportEscalationJobData>,
  ) {}

  async create(reporterId: number, dto: CreateReportDto) {
    await this.assertTargetExists(dto.targetType, dto.targetId);

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        details: dto.details,
      },
    });

    await this.escalationQueue.add('check', {
      targetType: dto.targetType,
      targetId: dto.targetId,
    });

    return {
      id: report.id,
      status: report.status,
      createdAt: report.createdAt,
    };
  }

  private async assertTargetExists(
    targetType: ReportTargetType,
    targetId: number,
  ): Promise<void> {
    const exists = await this.targetExists(targetType, targetId);
    if (!exists) {
      throw new NotFoundException(`${targetType} not found`);
    }
  }

  private async targetExists(
    targetType: ReportTargetType,
    targetId: number,
  ): Promise<boolean> {
    switch (targetType) {
      case ReportTargetType.post:
        return Boolean(
          await this.prisma.post.findFirst({
            where: { id: targetId, deletedAt: null },
          }),
        );
      case ReportTargetType.comment:
        return Boolean(
          await this.prisma.comment.findFirst({
            where: { id: targetId, deletedAt: null },
          }),
        );
      case ReportTargetType.user:
        return Boolean(
          await this.prisma.user.findFirst({
            where: { id: targetId, deletedAt: null },
          }),
        );
      case ReportTargetType.reel:
        return Boolean(
          await this.prisma.reel.findFirst({
            where: { id: targetId, deletedAt: null },
          }),
        );
      case ReportTargetType.story:
        return Boolean(
          await this.prisma.story.findFirst({ where: { id: targetId } }),
        );
      default:
        throw new BadRequestException('Unsupported report target type');
    }
  }
}
