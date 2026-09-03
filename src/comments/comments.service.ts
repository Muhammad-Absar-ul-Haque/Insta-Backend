import {
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
import { CreateCommentDto } from './dto/create-comment.dto';

const MENTION_PATTERN = /@([a-zA-Z0-9._]+)/g;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createTopLevel(userId: number, postId: number, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException('Post not found');
    }
    await this.assertPostVisible(post.userId, userId);

    const comment = await this.createAndCount(
      userId,
      postId,
      null,
      dto.content,
    );

    await this.notifications.create({
      userId: post.userId,
      actorId: userId,
      type: 'comment',
      targetType: 'post',
      targetId: postId,
    });
    await this.notifyMentions(dto.content, userId, postId, [post.userId]);

    return this.toDto(comment, 0);
  }

  async createReply(
    userId: number,
    parentCommentId: number,
    dto: CreateCommentDto,
  ) {
    const parent = await this.prisma.comment.findUnique({
      where: { id: parentCommentId },
    });
    if (!parent || parent.deletedAt) {
      throw new NotFoundException('Comment not found');
    }

    const comment = await this.createAndCount(
      userId,
      parent.postId,
      parentCommentId,
      dto.content,
    );

    await this.notifications.create({
      userId: parent.userId,
      actorId: userId,
      type: 'comment',
      targetType: 'comment',
      targetId: parentCommentId,
    });
    await this.notifyMentions(dto.content, userId, parent.postId, [
      parent.userId,
    ]);

    return this.toDto(comment, 0);
  }

  async listForPost(
    postId: number,
    viewerId: number,
    pagination: CursorPaginationDto,
  ) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException('Post not found');
    }
    await this.assertPostVisible(post.userId, viewerId);

    const rows = await this.prisma.comment.findMany({
      where: { postId, parentCommentId: null, deletedAt: null },
      include: {
        user: { select: USER_SUMMARY_SELECT },
        _count: { select: { replies: true } },
      },
      ...buildCursorArgs(pagination),
    });
    const { items, nextCursor } = toCursorPage(rows, pagination.limit);
    return {
      items: items.map((c) => this.toDto(c, c._count.replies)),
      nextCursor,
    };
  }

  async listReplies(
    commentId: number,
    viewerId: number,
    pagination: CursorPaginationDto,
  ) {
    const parent = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!parent || parent.deletedAt) {
      throw new NotFoundException('Comment not found');
    }
    const post = await this.prisma.post.findUniqueOrThrow({
      where: { id: parent.postId },
    });
    await this.assertPostVisible(post.userId, viewerId);

    const rows = await this.prisma.comment.findMany({
      where: { parentCommentId: commentId, deletedAt: null },
      include: { user: { select: USER_SUMMARY_SELECT } },
      ...buildCursorArgs(pagination),
    });
    const { items, nextCursor } = toCursorPage(rows, pagination.limit);
    return { items: items.map((c) => this.toDto(c, 0)), nextCursor };
  }

  async deleteComment(userId: number, commentId: number): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.deletedAt) {
      throw new NotFoundException('Comment not found');
    }
    const post = await this.prisma.post.findUniqueOrThrow({
      where: { id: comment.postId },
    });
    if (comment.userId !== userId && post.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    const activeReplies = comment.parentCommentId
      ? []
      : await this.prisma.comment.findMany({
          where: { parentCommentId: commentId, deletedAt: null },
        });

    await this.prisma.$transaction([
      this.prisma.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      }),
      ...activeReplies.map((r) =>
        this.prisma.comment.update({
          where: { id: r.id },
          data: { deletedAt: new Date() },
        }),
      ),
      this.prisma.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 + activeReplies.length } },
      }),
    ]);
  }

  private async createAndCount(
    userId: number,
    postId: number,
    parentCommentId: number | null,
    content: string,
  ) {
    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { userId, postId, parentCommentId, content },
        include: { user: { select: USER_SUMMARY_SELECT } },
      }),
      this.prisma.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      }),
    ]);
    return comment;
  }

  private async notifyMentions(
    content: string,
    actorId: number,
    postId: number,
    alreadyNotified: number[],
  ): Promise<void> {
    const usernames = [...content.matchAll(MENTION_PATTERN)].map((m) => m[1]);
    if (usernames.length === 0) return;

    const mentioned = await this.prisma.user.findMany({
      where: { username: { in: usernames }, deletedAt: null },
      select: { id: true },
    });
    const skip = new Set([actorId, ...alreadyNotified]);
    await Promise.all(
      mentioned
        .filter((u) => !skip.has(u.id))
        .map((u) =>
          this.notifications.create({
            userId: u.id,
            actorId,
            type: 'mention',
            targetType: 'post',
            targetId: postId,
          }),
        ),
    );
  }

  private async assertPostVisible(
    authorId: number,
    viewerId: number,
  ): Promise<void> {
    if (authorId === viewerId) return;
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
    });
    if (!author || !author.isPrivate) return;

    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId: viewerId, followingId: authorId },
      },
    });
    if (follow?.status !== FollowStatus.accepted) {
      throw new ForbiddenException('This account is private');
    }
  }

  private toDto(
    comment: {
      id: number;
      content: string;
      likeCount: number;
      createdAt: Date;
      parentCommentId: number | null;
      user: Parameters<typeof toUserSummary>[0];
    },
    replyCount: number,
  ) {
    return {
      id: comment.id,
      content: comment.content,
      likeCount: comment.likeCount,
      createdAt: comment.createdAt,
      parentCommentId: comment.parentCommentId,
      author: toUserSummary(comment.user),
      replyCount,
    };
  }
}
