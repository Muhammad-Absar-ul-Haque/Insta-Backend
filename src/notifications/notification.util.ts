import { NotificationType } from '@prisma/client';
import { toUserSummary, UserSummary } from '../common/utils/user-summary.util';

export interface NotificationRecord {
  id: number;
  type: NotificationType;
  targetType: string | null;
  targetId: number | null;
  isRead: boolean;
  createdAt: Date;
  actor: Parameters<typeof toUserSummary>[0] | null;
}

export interface NotificationDto {
  id: number;
  type: NotificationType;
  targetType: string | null;
  targetId: number | null;
  isRead: boolean;
  createdAt: Date;
  actor: UserSummary | null;
}

export function toNotificationDto(
  notification: NotificationRecord,
): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    targetType: notification.targetType,
    targetId: notification.targetId,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    actor: notification.actor ? toUserSummary(notification.actor) : null,
  };
}
