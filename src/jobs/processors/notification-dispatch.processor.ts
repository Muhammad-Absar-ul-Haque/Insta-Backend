import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { PresenceService } from '../../redis/presence.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { toNotificationDto } from '../../notifications/notification.util';
import { USER_SUMMARY_SELECT } from '../../common/utils/user-summary.util';
import { CreateNotificationInput } from '../../notifications/notifications.service';
import { QUEUE_NAMES } from '../queue.constants';

/** Consumes the notification-dispatch queue: writes the row, then pushes it over
 * WebSocket only if the recipient currently has an open connection. */
@Processor(QUEUE_NAMES.NOTIFICATION_DISPATCH)
export class NotificationDispatchProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly gateway: NotificationsGateway,
  ) {
    super();
  }

  async process(job: Job<CreateNotificationInput>): Promise<void> {
    const input = job.data;
    const notification = await this.prisma.notification.create({
      data: input,
      include: { actor: { select: USER_SUMMARY_SELECT } },
    });

    if (await this.presence.isOnline(input.userId)) {
      this.gateway.pushToUser(input.userId, toNotificationDto(notification));
    }
  }
}
