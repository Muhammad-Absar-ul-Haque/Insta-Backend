import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toCursorPage } from '../../common/utils/pagination.util';
import { USER_SUMMARY_SELECT } from '../../common/utils/user-summary.util';
import { AdminAuditService } from '../admin-audit.service';
import { ListContentQueryDto } from '../dto/list-content-query.dto';
import { AdminNotesDto } from '../dto/admin-notes.dto';

@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async listPosts(query: ListContentQueryDto) {
    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      ...(query.userId ? { userId: query.userId } : {}),
    };
    const rows = await this.prisma.post.findMany({
      where,
      include: {
        user: { select: USER_SUMMARY_SELECT },
        _count: { select: { media: true } },
      },
      take: query.limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy:
        query.sort === 'most_liked'
          ? [{ likeCount: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return toCursorPage(rows, query.limit);
  }

  async deletePost(
    adminId: number,
    postId: number,
    dto: AdminNotesDto,
  ): Promise<void> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException('Post not found');
    }
    await this.prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      adminId,
      actionType: 'delete_post',
      targetType: 'post',
      targetId: postId,
      notes: dto.notes,
    });
  }

  async listComments(query: ListContentQueryDto) {
    const where: Prisma.CommentWhereInput = {
      deletedAt: null,
      ...(query.userId ? { userId: query.userId } : {}),
    };
    const rows = await this.prisma.comment.findMany({
      where,
      include: { user: { select: USER_SUMMARY_SELECT } },
      take: query.limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy:
        query.sort === 'most_liked'
          ? [{ likeCount: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return toCursorPage(rows, query.limit);
  }

  async deleteComment(
    adminId: number,
    commentId: number,
    dto: AdminNotesDto,
  ): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.deletedAt) {
      throw new NotFoundException('Comment not found');
    }
    await this.prisma.$transaction([
      this.prisma.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      }),
      comment.postId !== null
        ? this.prisma.post.update({
            where: { id: comment.postId },
            data: { commentCount: { decrement: 1 } },
          })
        : this.prisma.reel.update({
            where: { id: comment.reelId! },
            data: { commentCount: { decrement: 1 } },
          }),
    ]);
    await this.audit.log({
      adminId,
      actionType: 'delete_comment',
      targetType: 'comment',
      targetId: commentId,
      notes: dto.notes,
    });
  }

  async listReels(query: ListContentQueryDto) {
    const where: Prisma.ReelWhereInput = {
      deletedAt: null,
      ...(query.userId ? { userId: query.userId } : {}),
    };
    const rows = await this.prisma.reel.findMany({
      where,
      include: { user: { select: USER_SUMMARY_SELECT } },
      take: query.limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy:
        query.sort === 'most_liked'
          ? [{ likeCount: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return toCursorPage(rows, query.limit);
  }

  async deleteReel(
    adminId: number,
    reelId: number,
    dto: AdminNotesDto,
  ): Promise<void> {
    const reel = await this.prisma.reel.findUnique({ where: { id: reelId } });
    if (!reel || reel.deletedAt) {
      throw new NotFoundException('Reel not found');
    }
    await this.prisma.reel.update({
      where: { id: reelId },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      adminId,
      actionType: 'delete_reel',
      targetType: 'reel',
      targetId: reelId,
      notes: dto.notes,
    });
  }
}
