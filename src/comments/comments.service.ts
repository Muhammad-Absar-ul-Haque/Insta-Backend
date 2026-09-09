import {
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
import { CreateCommentDto } from './dto/create-comment.dto';

const MENTION_PATTERN = /@([a-zA-Z0-9._]+)/g;
const MAX_PINNED_COMMENTS = 3;

/** A comment's root is either a post or a reel — never both, never neither.
 * Enforced here in the service (not a DB constraint), the same way this codebase
 * already handles the Like/Report polymorphic targets. */
export type CommentTargetType = 'post' | 'reel';

interface CommentTarget {
  type: CommentTargetType;
  id: number;
  ownerId: number;
  commentsDisabled: boolean;
  blockedKeywords: string[];
}

function matchesBlockedKeyword(
  content: string,
  blockedKeywords: string[],
): boolean {
  if (blockedKeywords.length === 0) return false;
  const lower = content.toLowerCase();
  return blockedKeywords.some((kw) => kw && lower.includes(kw.toLowerCase()));
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createTopLevel(
    userId: number,
    targetType: CommentTargetType,
    targetId: number,
    dto: CreateCommentDto,
  ) {
    const target = await this.getTarget(targetType, targetId);
    if (target.commentsDisabled) {
      throw new ForbiddenException(
        `Comments are disabled on this ${targetType}`,
      );
    }
    await this.assertOwnerVisible(target.ownerId, userId, targetType);

    const comment = await this.createAndCount(
      userId,
      target,
      null,
      dto.content,
    );

    await this.notifications.create({
      userId: target.ownerId,
      actorId: userId,
      type: 'comment',
      targetType,
      targetId,
    });
    await this.notifyMentions(dto.content, userId, targetType, targetId, [
      target.ownerId,
    ]);

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
    const targetType: CommentTargetType =
      parent.postId !== null ? 'post' : 'reel';
    const targetId = (parent.postId ?? parent.reelId)!;
    const target = await this.getTarget(targetType, targetId);
    if (target.commentsDisabled) {
      throw new ForbiddenException(
        `Comments are disabled on this ${targetType}`,
      );
    }

    const comment = await this.createAndCount(
      userId,
      target,
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
    await this.notifyMentions(dto.content, userId, targetType, targetId, [
      parent.userId,
    ]);

    return this.toDto(comment, 0);
  }

  async listForTarget(
    targetType: CommentTargetType,
    targetId: number,
    viewerId: number,
    pagination: CursorPaginationDto,
  ) {
    const target = await this.getTarget(targetType, targetId);
    await this.assertOwnerVisible(target.ownerId, viewerId, targetType);

    const targetFilter = this.targetFilter(targetType, targetId);
    const include = {
      user: { select: USER_SUMMARY_SELECT },
      _count: { select: { replies: true } },
    };

    // Pinned comments (max 3) are shown once, at the top of the first page only —
    // repeating them on every page of a keyset-paginated list would be both wrong
    // (they'd show up mixed into "older" pages too) and wasteful.
    const [pinned, rows] = await Promise.all([
      pagination.cursor === undefined
        ? this.prisma.comment.findMany({
            where: {
              ...targetFilter,
              parentCommentId: null,
              deletedAt: null,
              isFiltered: false,
              isPinned: true,
            },
            include,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          })
        : Promise.resolve([]),
      this.prisma.comment.findMany({
        where: {
          ...targetFilter,
          parentCommentId: null,
          deletedAt: null,
          isFiltered: false,
          isPinned: false,
        },
        include,
        ...buildCursorArgs(pagination),
      }),
    ]);
    const { items, nextCursor } = toCursorPage(rows, pagination.limit);
    const [visiblePinned, visibleItems] = await Promise.all([
      this.filterRestrictedComments(pinned, target.ownerId, viewerId),
      this.filterRestrictedComments(items, target.ownerId, viewerId),
    ]);
    return {
      items: [
        ...visiblePinned.map((c) => this.toDto(c, c._count.replies)),
        ...visibleItems.map((c) => this.toDto(c, c._count.replies)),
      ],
      nextCursor,
    };
  }

  /** A restricted user's comments on the owner's posts/reels are only visible to the
   * owner and to the restricted user themselves — the restriction is never disclosed
   * to anyone else, including other commenters. */
  private async filterRestrictedComments<T extends { userId: number }>(
    comments: T[],
    ownerId: number,
    viewerId: number,
  ): Promise<T[]> {
    if (comments.length === 0 || viewerId === ownerId) return comments;

    const restricted = await this.prisma.restrictedUser.findMany({
      where: { restrictorId: ownerId },
      select: { restrictedId: true },
    });
    if (restricted.length === 0) return comments;

    const restrictedIds = new Set(restricted.map((r) => r.restrictedId));
    return comments.filter(
      (c) => c.userId === viewerId || !restrictedIds.has(c.userId),
    );
  }

  /** Owner-only: comments auto-hidden by their blocked-keyword filter. */
  async listFiltered(
    userId: number,
    targetType: CommentTargetType,
    targetId: number,
    pagination: CursorPaginationDto,
  ) {
    const target = await this.getTarget(targetType, targetId);
    if (target.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can view filtered comments');
    }

    const rows = await this.prisma.comment.findMany({
      where: {
        ...this.targetFilter(targetType, targetId),
        parentCommentId: null,
        deletedAt: null,
        isFiltered: true,
      },
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

  async setPinned(
    userId: number,
    commentId: number,
    isPinned: boolean,
  ): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.deletedAt) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.parentCommentId !== null) {
      throw new ForbiddenException('Replies cannot be pinned');
    }
    const targetType: CommentTargetType =
      comment.postId !== null ? 'post' : 'reel';
    const targetId = (comment.postId ?? comment.reelId)!;
    const target = await this.getTarget(targetType, targetId);
    if (target.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can pin comments');
    }

    if (isPinned && !comment.isPinned) {
      const pinnedCount = await this.prisma.comment.count({
        where: {
          ...this.targetFilter(targetType, targetId),
          isPinned: true,
          deletedAt: null,
        },
      });
      if (pinnedCount >= MAX_PINNED_COMMENTS) {
        throw new ConflictException(
          `You can only pin up to ${MAX_PINNED_COMMENTS} comments`,
        );
      }
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { isPinned },
    });
  }

  async setCommentsDisabled(
    userId: number,
    targetType: CommentTargetType,
    targetId: number,
    commentsDisabled: boolean,
  ): Promise<void> {
    const target = await this.getTarget(targetType, targetId);
    if (target.ownerId !== userId) {
      throw new ForbiddenException(
        `You can only manage comments on your own ${targetType}s`,
      );
    }
    if (targetType === 'post') {
      await this.prisma.post.update({
        where: { id: targetId },
        data: { commentsDisabled },
      });
    } else {
      await this.prisma.reel.update({
        where: { id: targetId },
        data: { commentsDisabled },
      });
    }
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
    const targetType: CommentTargetType =
      parent.postId !== null ? 'post' : 'reel';
    const targetId = (parent.postId ?? parent.reelId)!;
    const target = await this.getTarget(targetType, targetId);
    await this.assertOwnerVisible(target.ownerId, viewerId, targetType);

    const rows = await this.prisma.comment.findMany({
      where: { parentCommentId: commentId, deletedAt: null, isFiltered: false },
      include: { user: { select: USER_SUMMARY_SELECT } },
      ...buildCursorArgs(pagination),
    });
    const { items, nextCursor } = toCursorPage(rows, pagination.limit);
    const visibleItems = await this.filterRestrictedComments(
      items,
      target.ownerId,
      viewerId,
    );
    return { items: visibleItems.map((c) => this.toDto(c, 0)), nextCursor };
  }

  async deleteComment(userId: number, commentId: number): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.deletedAt) {
      throw new NotFoundException('Comment not found');
    }
    const targetType: CommentTargetType =
      comment.postId !== null ? 'post' : 'reel';
    const targetId = (comment.postId ?? comment.reelId)!;
    const target = await this.getTarget(targetType, targetId);
    if (comment.userId !== userId && target.ownerId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    const activeReplies = comment.parentCommentId
      ? []
      : await this.prisma.comment.findMany({
          where: { parentCommentId: commentId, deletedAt: null },
        });
    const countDecrement = 1 + activeReplies.length;

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
      targetType === 'post'
        ? this.prisma.post.update({
            where: { id: targetId },
            data: { commentCount: { decrement: countDecrement } },
          })
        : this.prisma.reel.update({
            where: { id: targetId },
            data: { commentCount: { decrement: countDecrement } },
          }),
    ]);
  }

  private async getTarget(
    targetType: CommentTargetType,
    targetId: number,
  ): Promise<CommentTarget> {
    if (targetType === 'post') {
      const post = await this.prisma.post.findUnique({
        where: { id: targetId },
        include: { user: { select: { blockedKeywords: true } } },
      });
      if (!post || post.deletedAt) {
        throw new NotFoundException('Post not found');
      }
      return {
        type: 'post',
        id: post.id,
        ownerId: post.userId,
        commentsDisabled: post.commentsDisabled,
        blockedKeywords: post.user.blockedKeywords,
      };
    }

    const reel = await this.prisma.reel.findUnique({
      where: { id: targetId },
      include: { user: { select: { blockedKeywords: true } } },
    });
    if (!reel || reel.deletedAt) {
      throw new NotFoundException('Reel not found');
    }
    return {
      type: 'reel',
      id: reel.id,
      ownerId: reel.userId,
      commentsDisabled: reel.commentsDisabled,
      blockedKeywords: reel.user.blockedKeywords,
    };
  }

  private targetFilter(targetType: CommentTargetType, targetId: number) {
    return targetType === 'post' ? { postId: targetId } : { reelId: targetId };
  }

  private async createAndCount(
    userId: number,
    target: CommentTarget,
    parentCommentId: number | null,
    content: string,
  ) {
    const isFiltered = matchesBlockedKeyword(content, target.blockedKeywords);
    const countUpdate =
      target.type === 'post'
        ? this.prisma.post.update({
            where: { id: target.id },
            data: { commentCount: { increment: 1 } },
          })
        : this.prisma.reel.update({
            where: { id: target.id },
            data: { commentCount: { increment: 1 } },
          });

    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: {
          userId,
          parentCommentId,
          content,
          isFiltered,
          postId: target.type === 'post' ? target.id : null,
          reelId: target.type === 'reel' ? target.id : null,
        },
        include: { user: { select: USER_SUMMARY_SELECT } },
      }),
      countUpdate,
    ]);
    return comment;
  }

  private async notifyMentions(
    content: string,
    actorId: number,
    targetType: CommentTargetType,
    targetId: number,
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
            targetType,
            targetId,
          }),
        ),
    );
  }

  private async assertOwnerVisible(
    ownerId: number,
    viewerId: number,
    targetType: CommentTargetType,
  ): Promise<void> {
    if (ownerId === viewerId) return;
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (owner?.deletedAt || owner?.deactivatedAt) {
      throw new NotFoundException(
        targetType === 'post' ? 'Post not found' : 'Reel not found',
      );
    }
    if (!owner || !owner.isPrivate) return;

    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId: viewerId, followingId: ownerId },
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
      isPinned?: boolean;
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
      isPinned: comment.isPinned ?? false,
      author: toUserSummary(comment.user),
      replyCount,
    };
  }
}
