import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { toCursorPage } from '../common/utils/pagination.util';
import {
  getLikedPostIds,
  getSavedPostIds,
  POST_WITH_RELATIONS_INCLUDE,
  toPostSummary,
} from '../posts/posts.util';

const HASHTAG_PATTERN = /#([a-z0-9_][a-z0-9_]*)/gi;
const MAX_TAGS_PER_POST = 30;

@Injectable()
export class HashtagsService {
  constructor(private readonly prisma: PrismaService) {}

  extractTags(caption: string | null | undefined): string[] {
    if (!caption) return [];
    const matches = caption.matchAll(HASHTAG_PATTERN);
    const tags = new Set<string>();
    for (const match of matches) {
      tags.add(match[1].toLowerCase());
      if (tags.size >= MAX_TAGS_PER_POST) break;
    }
    return [...tags];
  }

  /** Upserts each hashtag and links it to the post. Called synchronously from post creation
   * today; swap the call site for a queue.add() once the BullMQ job infra is wired up. */
  async linkPostHashtags(postId: number, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const hashtag = await this.prisma.hashtag.upsert({
        where: { tag },
        create: { tag, postCount: 1 },
        update: { postCount: { increment: 1 } },
      });
      await this.prisma.postHashtag.create({
        data: { postId, hashtagId: hashtag.id },
      });
    }
  }

  async getPostsByTag(
    tag: string,
    viewerId: number,
    pagination: CursorPaginationDto,
  ) {
    const hashtag = await this.prisma.hashtag.findUnique({
      where: { tag: tag.toLowerCase() },
    });
    if (!hashtag || hashtag.isBlocked) {
      throw new NotFoundException('Hashtag not found');
    }

    const rows = await this.prisma.postHashtag.findMany({
      where: { hashtagId: hashtag.id, post: { deletedAt: null } },
      include: { post: { include: POST_WITH_RELATIONS_INCLUDE } },
      orderBy: [{ post: { createdAt: 'desc' } }, { post: { id: 'desc' } }],
      ...(pagination.cursor
        ? {
            skip: 1,
            cursor: {
              postId_hashtagId: {
                postId: pagination.cursor,
                hashtagId: hashtag.id,
              },
            },
          }
        : {}),
      take: pagination.limit + 1,
    });

    const posts = rows.map((r) => r.post);
    const { items, nextCursor } = toCursorPage(posts, pagination.limit);
    const postIds = items.map((p) => p.id);
    const [likedIds, savedIds] = await Promise.all([
      getLikedPostIds(this.prisma, viewerId, postIds),
      getSavedPostIds(this.prisma, viewerId, postIds),
    ]);

    return {
      hashtag: { tag: hashtag.tag, postCount: hashtag.postCount },
      items: items.map((post) =>
        toPostSummary(post, {
          isLiked: likedIds.has(post.id),
          isSaved: savedIds.has(post.id),
        }),
      ),
      nextCursor,
    };
  }
}
