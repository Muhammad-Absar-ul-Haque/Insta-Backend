import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FollowStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FeedCacheService } from '../../feed/feed-cache.service';
import { QUEUE_NAMES } from '../queue.constants';

export const FANOUT_FOLLOWER_THRESHOLD = 10_000;
const FOLLOWER_BATCH_SIZE = 500;

export interface FeedFanoutJobData {
  postId: number;
  authorId: number;
  createdAt: string;
}

/**
 * Push a newly-created post into every follower's cached feed (`feed:{userId}` in Redis)
 * so home-feed reads are an O(page size) sorted-set lookup instead of a fan-out-on-read
 * join. Skipped for accounts above FANOUT_FOLLOWER_THRESHOLD — those get merged into the
 * feed at read time instead (see FeedService.getHomeFeed), since fanning out a single
 * post to millions of followers on every write doesn't scale.
 */
@Processor(QUEUE_NAMES.FEED_FANOUT)
export class FeedFanoutProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feedCache: FeedCacheService,
  ) {
    super();
  }

  async process(job: Job<FeedFanoutJobData>): Promise<void> {
    const { postId, authorId, createdAt } = job.data;
    const scoreMs = new Date(createdAt).getTime();

    // Authors always see their own posts in their own feed, regardless of follower count.
    await this.feedCache.addPost(authorId, postId, scoreMs);

    const followerCount = await this.prisma.follow.count({
      where: { followingId: authorId, status: FollowStatus.accepted },
    });
    if (followerCount > FANOUT_FOLLOWER_THRESHOLD) {
      return;
    }

    let cursor: number | undefined;
    for (;;) {
      const followers = await this.prisma.follow.findMany({
        where: { followingId: authorId, status: FollowStatus.accepted },
        select: { id: true, followerId: true },
        take: FOLLOWER_BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });
      if (followers.length === 0) break;

      await Promise.all(
        followers.map((f) =>
          this.feedCache.addPost(f.followerId, postId, scoreMs),
        ),
      );

      cursor = followers[followers.length - 1].id;
      if (followers.length < FOLLOWER_BATCH_SIZE) break;
    }
  }
}
