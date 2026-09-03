import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

const MAX_FEED_SIZE = 800;
const SEEDED_TTL_SECONDS = 60 * 60 * 24;

function feedKey(userId: number): string {
  return `feed:${userId}`;
}

function seededKey(userId: number): string {
  return `feed:${userId}:seeded`;
}

/**
 * Redis-backed fan-out-on-write cache: `feed:{userId}` is a sorted set of post ids
 * scored by the post's createdAt (ms epoch). Populated by FeedFanoutProcessor,
 * read by FeedService for the "normal" (non-celebrity) part of the home feed.
 */
@Injectable()
export class FeedCacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async addPost(
    userId: number,
    postId: number,
    scoreMs: number,
  ): Promise<void> {
    await this.redis.zadd(feedKey(userId), scoreMs, String(postId));
    // Keep only the most recent MAX_FEED_SIZE entries so a single hot follower doesn't grow unbounded.
    await this.redis.zremrangebyrank(feedKey(userId), 0, -(MAX_FEED_SIZE + 1));
  }

  /** Whether this user's cache has ever been seeded from Postgres (distinct from "empty"). */
  async isSeeded(userId: number): Promise<boolean> {
    return (await this.redis.exists(seededKey(userId))) === 1;
  }

  async seed(
    userId: number,
    entries: { postId: number; scoreMs: number }[],
  ): Promise<void> {
    const pipeline = this.redis.pipeline();
    for (const entry of entries) {
      pipeline.zadd(feedKey(userId), entry.scoreMs, String(entry.postId));
    }
    pipeline.zremrangebyrank(feedKey(userId), 0, -(MAX_FEED_SIZE + 1));
    pipeline.set(seededKey(userId), '1', 'EX', SEEDED_TTL_SECONDS);
    await pipeline.exec();
  }

  async getPage(
    userId: number,
    beforeMs: number | null,
    limit: number,
  ): Promise<number[]> {
    const max = beforeMs !== null ? `(${beforeMs}` : '+inf';
    const members = await this.redis.zrevrangebyscore(
      feedKey(userId),
      max,
      '-inf',
      'LIMIT',
      0,
      limit,
    );
    return members.map(Number);
  }
}
