import { Injectable, NotFoundException } from '@nestjs/common';
import { LikeTargetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async like(
    userId: number,
    targetType: LikeTargetType,
    targetId: number,
  ): Promise<{ liked: boolean }> {
    const ownerId = await this.getOwnerId(targetType, targetId);

    const existing = await this.prisma.like.findUnique({
      where: { userId_targetType_targetId: { userId, targetType, targetId } },
    });
    if (existing) {
      return { liked: true };
    }

    await this.prisma.$transaction([
      this.prisma.like.create({ data: { userId, targetType, targetId } }),
      this.incrementCount(targetType, targetId, 1),
    ]);

    await this.notifications.create({
      userId: ownerId,
      actorId: userId,
      type: 'like',
      targetType,
      targetId,
    });

    return { liked: true };
  }

  async unlike(
    userId: number,
    targetType: LikeTargetType,
    targetId: number,
  ): Promise<{ liked: boolean }> {
    const existing = await this.prisma.like.findUnique({
      where: { userId_targetType_targetId: { userId, targetType, targetId } },
    });
    if (!existing) {
      return { liked: false };
    }

    await this.prisma.$transaction([
      this.prisma.like.delete({ where: { id: existing.id } }),
      this.incrementCount(targetType, targetId, -1),
    ]);

    return { liked: false };
  }

  private async getOwnerId(
    targetType: LikeTargetType,
    targetId: number,
  ): Promise<number> {
    switch (targetType) {
      case LikeTargetType.post: {
        const post = await this.prisma.post.findUnique({
          where: { id: targetId },
        });
        if (!post || post.deletedAt)
          throw new NotFoundException('Post not found');
        return post.userId;
      }
      case LikeTargetType.comment: {
        const comment = await this.prisma.comment.findUnique({
          where: { id: targetId },
        });
        if (!comment || comment.deletedAt)
          throw new NotFoundException('Comment not found');
        return comment.userId;
      }
      case LikeTargetType.reel: {
        const reel = await this.prisma.reel.findUnique({
          where: { id: targetId },
        });
        if (!reel || reel.deletedAt)
          throw new NotFoundException('Reel not found');
        return reel.userId;
      }
      case LikeTargetType.story: {
        const story = await this.prisma.story.findUnique({
          where: { id: targetId },
        });
        if (!story || !story.isActive || story.expiresAt < new Date())
          throw new NotFoundException('Story not found');
        return story.userId;
      }
    }
  }

  private incrementCount(
    targetType: LikeTargetType,
    targetId: number,
    delta: 1 | -1,
  ) {
    const data = { likeCount: { increment: delta } };
    switch (targetType) {
      case LikeTargetType.post:
        return this.prisma.post.update({ where: { id: targetId }, data });
      case LikeTargetType.comment:
        return this.prisma.comment.update({ where: { id: targetId }, data });
      case LikeTargetType.reel:
        return this.prisma.reel.update({ where: { id: targetId }, data });
      case LikeTargetType.story:
        return this.prisma.story.update({ where: { id: targetId }, data });
    }
  }
}
