import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FollowStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { buildCursorArgs, toCursorPage } from '../common/utils/pagination.util';
import {
  toUserSummary,
  USER_SUMMARY_SELECT,
} from '../common/utils/user-summary.util';

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async follow(followerId: number, targetId: number) {
    if (followerId === targetId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!target || target.deletedAt || target.deactivatedAt) {
      throw new NotFoundException('User not found');
    }

    await this.assertNotBlocked(followerId, targetId);

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId: targetId } },
    });
    if (existing) {
      throw new ConflictException(
        existing.status === FollowStatus.pending
          ? 'Follow request already sent'
          : 'Already following this user',
      );
    }

    const status = target.isPrivate
      ? FollowStatus.pending
      : FollowStatus.accepted;
    const follow = await this.prisma.follow.create({
      data: { followerId, followingId: targetId, status },
    });

    await this.notifications.create({
      userId: targetId,
      actorId: followerId,
      type: status === FollowStatus.pending ? 'follow_request' : 'follow',
      targetType: 'follow',
      targetId: follow.id,
    });

    return { status };
  }

  async unfollow(followerId: number, targetId: number): Promise<void> {
    await this.prisma.follow.deleteMany({
      where: { followerId, followingId: targetId },
    });
  }

  async listPendingRequests(userId: number, pagination: CursorPaginationDto) {
    const rows = await this.prisma.follow.findMany({
      where: { followingId: userId, status: FollowStatus.pending },
      include: { follower: { select: USER_SUMMARY_SELECT } },
      ...buildCursorArgs(pagination),
    });
    const { items, nextCursor } = toCursorPage(rows, pagination.limit);
    return {
      items: items.map((row) => ({
        requestId: row.id,
        user: toUserSummary(row.follower),
        createdAt: row.createdAt,
      })),
      nextCursor,
    };
  }

  async acceptRequest(userId: number, requestId: number) {
    const request = await this.prisma.follow.findUnique({
      where: { id: requestId },
    });
    if (
      !request ||
      request.followingId !== userId ||
      request.status !== FollowStatus.pending
    ) {
      throw new NotFoundException('Follow request not found');
    }

    const updated = await this.prisma.follow.update({
      where: { id: requestId },
      data: { status: FollowStatus.accepted },
    });

    await this.notifications.create({
      userId: request.followerId,
      actorId: userId,
      type: 'follow',
      targetType: 'follow',
      targetId: updated.id,
    });

    return { status: updated.status };
  }

  async rejectRequest(userId: number, requestId: number): Promise<void> {
    const request = await this.prisma.follow.findUnique({
      where: { id: requestId },
    });
    if (
      !request ||
      request.followingId !== userId ||
      request.status !== FollowStatus.pending
    ) {
      throw new NotFoundException('Follow request not found');
    }
    await this.prisma.follow.delete({ where: { id: requestId } });
  }

  async listFollowers(
    targetUserId: number,
    viewerId: number,
    pagination: CursorPaginationDto,
  ) {
    await this.assertListVisible(targetUserId, viewerId);

    const rows = await this.prisma.follow.findMany({
      where: { followingId: targetUserId, status: FollowStatus.accepted },
      include: { follower: { select: USER_SUMMARY_SELECT } },
      ...buildCursorArgs(pagination),
    });
    const { items, nextCursor } = toCursorPage(rows, pagination.limit);
    return {
      items: items.map((row) => toUserSummary(row.follower)),
      nextCursor,
    };
  }

  async listFollowing(
    targetUserId: number,
    viewerId: number,
    pagination: CursorPaginationDto,
  ) {
    await this.assertListVisible(targetUserId, viewerId);

    const rows = await this.prisma.follow.findMany({
      where: { followerId: targetUserId, status: FollowStatus.accepted },
      include: { following: { select: USER_SUMMARY_SELECT } },
      ...buildCursorArgs(pagination),
    });
    const { items, nextCursor } = toCursorPage(rows, pagination.limit);
    return {
      items: items.map((row) => toUserSummary(row.following)),
      nextCursor,
    };
  }

  private async assertListVisible(
    targetUserId: number,
    viewerId: number,
  ): Promise<void> {
    if (targetUserId === viewerId) return;

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target || target.deletedAt || target.deactivatedAt) {
      throw new NotFoundException('User not found');
    }
    if (!target.isPrivate) return;

    const viewerFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: viewerId,
          followingId: targetUserId,
        },
      },
    });
    if (viewerFollow?.status !== FollowStatus.accepted) {
      throw new ForbiddenException('This account is private');
    }
  }

  private async assertNotBlocked(
    userAId: number,
    userBId: number,
  ): Promise<void> {
    const block = await this.prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: userAId, blockedId: userBId },
          { blockerId: userBId, blockedId: userAId },
        ],
      },
    });
    if (block) {
      throw new ForbiddenException('Unable to follow this user');
    }
  }
}
