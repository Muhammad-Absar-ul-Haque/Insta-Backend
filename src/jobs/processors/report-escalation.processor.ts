import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ReportTargetType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue.constants';

const ESCALATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const ESCALATION_THRESHOLD = 3;

export interface ReportEscalationJobData {
  targetType: ReportTargetType;
  targetId: number;
}

/** Enqueued after every report is filed; flags content that's accumulating reports
 * fast so moderators see it before it works through the queue in FIFO order. */
@Processor(QUEUE_NAMES.REPORT_ESCALATION)
export class ReportEscalationProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportEscalationProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ReportEscalationJobData>): Promise<void> {
    const { targetType, targetId } = job.data;
    const recentCount = await this.prisma.report.count({
      where: {
        targetType,
        targetId,
        status: 'pending',
        createdAt: { gte: new Date(Date.now() - ESCALATION_WINDOW_MS) },
      },
    });

    if (recentCount >= ESCALATION_THRESHOLD) {
      this.logger.warn(
        `${targetType}:${targetId} has ${recentCount} pending reports in the last 24h — escalating for priority review`,
      );
    }
  }
}
