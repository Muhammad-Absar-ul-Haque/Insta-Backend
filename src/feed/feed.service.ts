import { Injectable } from '@nestjs/common';
import { FollowStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { toCursorPage } from '../common/utils/pagination.util';
import {
  getLikedPostIds,
  getSavedPostIds,
  POST_WITH_RELATIONS_INCLUDE,
  PostWithRelations,
  toPostSummary,
} from '../posts/posts.util';
import { FeedCacheService } from './feed-cache.service';
import { FANOUT_FOLLOWER_THRESHOLD } from '../jobs/processors/feed-fanout.processor';

const EXPLORE_WINDOW_DAYS = 14;
const SEED_SIZE = 200;

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feedCache: FeedCacheService,
  ) {}

  /**
   * Hybrid fan-out home feed: posts from "normal" followees are read from the
   * Redis cache populated by FeedFanoutProcessor (fan-out-on-write); posts from
   * accounts above FANOUT_FOLLOWER_THRESHOLD ("celebrities") are excluded from
   * fan-out and merged in here at read time instead, so a single post from a
   * huge account doesn't trigger millions of writes.
   *
   * Note: the cursor here is a millisecond timestamp, not a row id (unlike every
   * other list endpoint) — the merged feed is sorted by createdAt, not id.
   */
  async getHomeFeed(viewerId: number, pagination: CursorPaginationDto) {
    const beforeMs = pagination.cursor ?? null;

    if (!(await this.feedCache.isSeeded(viewerId))) {
      await this.seedCache(viewerId);
    }

    const following = await this.prisma.follow.findMany({
      where: { followerId: viewerId, status: FollowStatus.accepted },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);
    const celebrityIds = await this.filterCelebrities(followingIds);

    const [cachedPostIds, celebrityPosts] = await Promise.all([
      this.feedCache.getPage(viewerId, beforeMs, pagination.limit + 1),
      this.getCelebrityPosts(celebrityIds, beforeMs, pagination.limit + 1),
    ]);

    const cachedPosts = await this.fetchPostsPreservingOrder(cachedPostIds);

    const merged = [...cachedPosts, ...celebrityPosts]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .filter(
        (post, index, arr) => arr.findIndex((p) => p.id === post.id) === index,
      )
      .slice(0, pagination.limit + 1);

    const hasMore = merged.length > pagination.limit;
    const items = hasMore ? merged.slice(0, pagination.limit) : merged;
    const nextCursor = hasMore
      ? items[items.length - 1].createdAt.getTime()
      : null;

    return this.toPage(items, nextCursor, viewerId);
  }

  async getExplore(viewerId: number, pagination: CursorPaginationDto) {
    const following = await this.prisma.follow.findMany({
      where: { followerId: viewerId, status: FollowStatus.accepted },
      select: { followingId: true },
    });
    const blocked = await this.prisma.blockedUser.findMany({
      where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
      select: { blockerId: true, blockedId: true },
    });
    const excludedAuthorIds = new Set<number>([
      viewerId,
      ...following.map((f) => f.followingId),
      ...blocked.flatMap((b) => [b.blockerId, b.blockedId]),
    ]);

    const since = new Date(
      Date.now() - EXPLORE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const rows = await this.prisma.post.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: since },
        userId: { notIn: [...excludedAuthorIds] },
        user: { isPrivate: false },
      },
      include: POST_WITH_RELATIONS_INCLUDE,
      take: pagination.limit + 1,
      ...(pagination.cursor !== undefined
        ? { skip: 1, cursor: { id: pagination.cursor } }
        : {}),
      orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });

    const { items, nextCursor } = toCursorPage(rows, pagination.limit);
    return this.toPage(items, nextCursor, viewerId);
  }

  /** Cold start (new account, or a Redis flush): warm the cache from Postgres so
   * the feed isn't empty until the next post from someone they follow arrives. */
  private async seedCache(viewerId: number): Promise<void> {
    const following = await this.prisma.follow.findMany({
      where: { followerId: viewerId, status: FollowStatus.accepted },
      select: { followingId: true },
    });
    const authorIds = [viewerId, ...following.map((f) => f.followingId)];

    const posts = await this.prisma.post.findMany({
      where: { userId: { in: authorIds }, deletedAt: null },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: SEED_SIZE,
    });

    await this.feedCache.seed(
      viewerId,
      posts.map((p) => ({ postId: p.id, scoreMs: p.createdAt.getTime() })),
    );
  }

  private async filterCelebrities(userIds: number[]): Promise<number[]> {
    if (userIds.length === 0) return [];
    const counts = await this.prisma.follow.groupBy({
      by: ['followingId'],
      where: { followingId: { in: userIds }, status: FollowStatus.accepted },
      _count: true,
    });
    return counts
      .filter((c) => c._count > FANOUT_FOLLOWER_THRESHOLD)
      .map((c) => c.followingId);
  }

  private async getCelebrityPosts(
    celebrityIds: number[],
    beforeMs: number | null,
    limit: number,
  ) {
    if (celebrityIds.length === 0) return [];
    return this.prisma.post.findMany({
      where: {
        userId: { in: celebrityIds },
        deletedAt: null,
        ...(beforeMs !== null ? { createdAt: { lt: new Date(beforeMs) } } : {}),
      },
      include: POST_WITH_RELATIONS_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async fetchPostsPreservingOrder(
    postIds: number[],
  ): Promise<PostWithRelations[]> {
    if (postIds.length === 0) return [];
    const posts = await this.prisma.post.findMany({
      where: { id: { in: postIds }, deletedAt: null },
      include: POST_WITH_RELATIONS_INCLUDE,
    });
    const byId = new Map(posts.map((p) => [p.id, p]));
    return postIds
      .map((id) => byId.get(id))
      .filter((p): p is PostWithRelations => Boolean(p));
  }

  private async toPage(
    items: PostWithRelations[],
    nextCursor: number | null,
    viewerId: number,
  ) {
    const postIds = items.map((p) => p.id);
    const [likedIds, savedIds] = await Promise.all([
      getLikedPostIds(this.prisma, viewerId, postIds),
      getSavedPostIds(this.prisma, viewerId, postIds),
    ]);
    return {
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
