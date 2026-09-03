import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { buildCursorArgs, toCursorPage } from '../common/utils/pagination.util';
import { USER_SUMMARY_SELECT } from '../common/utils/user-summary.util';
import { QUEUE_NAMES } from '../jobs/queue.constants';
import { toNotificationDto } from './notification.util';

export interface CreateNotificationInput {
  userId: number;
  actorId?: number;
  type: NotificationType;
  targetType?: string;
  targetId?: number;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION_DISPATCH)
    private readonly dispatchQueue: Queue<CreateNotificationInput>,
  ) {}

  /** Enqueues creation + realtime push; see NotificationDispatchProcessor for the actual work. */
  async create(input: CreateNotificationInput): Promise<void> {
    // Never notify a user about their own action (liking your own post, etc).
    if (input.actorId && input.actorId === input.userId) {
      return;
    }
    await this.dispatchQueue.add('dispatch', input);
  }

  async findForUser(userId: number, pagination: CursorPaginationDto) {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      include: { actor: { select: USER_SUMMARY_SELECT } },
      ...buildCursorArgs(pagination),
    });
    const { items, nextCursor } = toCursorPage(rows, pagination.limit);
    return { items: items.map((row) => toNotificationDto(row)), nextCursor };
  }

  async markRead(userId: number, notificationId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException();
    }
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: number): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: number): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }
}
