import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { toCursorPage } from '../common/utils/pagination.util';
import {
  getLikedPostIds,
  POST_WITH_RELATIONS_INCLUDE,
  toPostSummary,
} from '../posts/posts.util';

@Injectable()
export class SavedService {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    userId: number,
    postId: number,
    collectionName = 'All Posts',
  ): Promise<void> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException('Post not found');
    }

    await this.prisma.savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId, collectionName },
      update: {},
    });
  }

  async unsave(userId: number, postId: number): Promise<void> {
    await this.prisma.savedPost.deleteMany({ where: { userId, postId } });
  }

  async listSaved(
    userId: number,
    pagination: CursorPaginationDto,
    collectionName?: string,
  ) {
    const rows = await this.prisma.savedPost.findMany({
      where: { userId, ...(collectionName ? { collectionName } : {}) },
      include: { post: { include: POST_WITH_RELATIONS_INCLUDE } },
      take: pagination.limit + 1,
      ...(pagination.cursor
        ? { skip: 1, cursor: { id: pagination.cursor } }
        : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const { items, nextCursor } = toCursorPage(rows, pagination.limit);
    const posts = items
      .map((row) => row.post)
      .filter((post) => post.deletedAt === null);
    const likedIds = await getLikedPostIds(
      this.prisma,
      userId,
      posts.map((p) => p.id),
    );

    return {
      items: posts.map((post) =>
        toPostSummary(post, { isLiked: likedIds.has(post.id), isSaved: true }),
      ),
      nextCursor,
    };
  }

  /** Distinct collection names for this user, each with a count and a preview post. */
  async listCollections(userId: number) {
    const groups = await this.prisma.savedPost.groupBy({
      by: ['collectionName'],
      where: { userId },
      _count: { _all: true },
      orderBy: { collectionName: 'asc' },
    });

    return Promise.all(
      groups.map(async (group) => {
        const preview = await this.prisma.savedPost.findFirst({
          where: { userId, collectionName: group.collectionName },
          include: { post: { include: POST_WITH_RELATIONS_INCLUDE } },
          orderBy: { createdAt: 'desc' },
        });
        return {
          collectionName: group.collectionName,
          count: group._count._all,
          previewPost: preview
            ? toPostSummary(preview.post, { isLiked: false, isSaved: true })
            : null,
        };
      }),
    );
  }
}
