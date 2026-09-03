import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FollowStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../media/cloudinary.service';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { buildCursorArgs, toCursorPage } from '../common/utils/pagination.util';
import {
  getLikedPostIds,
  getSavedPostIds,
  POST_WITH_RELATIONS_INCLUDE,
  toPostSummary,
} from './posts.util';
import { CreatePostDto } from './dto/create-post.dto';
import { QUEUE_NAMES } from '../jobs/queue.constants';
import { FeedFanoutJobData } from '../jobs/processors/feed-fanout.processor';
import { HashtagExtractionJobData } from '../jobs/processors/hashtag-extraction.processor';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    @InjectQueue(QUEUE_NAMES.FEED_FANOUT)
    private readonly feedFanoutQueue: Queue<FeedFanoutJobData>,
    @InjectQueue(QUEUE_NAMES.HASHTAG_EXTRACTION)
    private readonly hashtagQueue: Queue<HashtagExtractionJobData>,
  ) {}

  async createPost(userId: number, dto: CreatePostDto) {
    const post = await this.prisma.post.create({
      data: { userId, caption: dto.caption },
    });

    const uploads = await Promise.all(
      dto.media.map(async (item, index) => {
        const signed = this.cloudinary.createSignedUpload(
          'posts',
          userId,
          item.mediaType,
        );
        const postMedia = await this.prisma.postMedia.create({
          data: {
            postId: post.id,
            mediaType: item.mediaType,
            storageKey: signed.publicId,
            cdnUrl: signed.cdnUrl,
            orderIndex: index,
          },
        });
        return { postMediaId: postMedia.id, ...signed };
      }),
    );

    await this.hashtagQueue.add('extract', {
      postId: post.id,
      caption: dto.caption ?? null,
    });
    await this.feedFanoutQueue.add('fanout', {
      postId: post.id,
      authorId: userId,
      createdAt: post.createdAt.toISOString(),
    });

    const full = await this.prisma.post.findUniqueOrThrow({
      where: { id: post.id },
      include: POST_WITH_RELATIONS_INCLUDE,
    });

    return {
      post: toPostSummary(full, { isLiked: false, isSaved: false }),
      uploads,
    };
  }

  async getById(postId: number, viewerId: number) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: POST_WITH_RELATIONS_INCLUDE,
    });
    if (!post || post.deletedAt) {
      throw new NotFoundException('Post not found');
    }
    await this.assertVisible(post.userId, viewerId);

    const [likedIds, savedIds] = await Promise.all([
      getLikedPostIds(this.prisma, viewerId, [post.id]),
      getSavedPostIds(this.prisma, viewerId, [post.id]),
    ]);
    return toPostSummary(post, {
      isLiked: likedIds.has(post.id),
      isSaved: savedIds.has(post.id),
    });
  }

  async listByUser(
    targetUserId: number,
    viewerId: number,
    pagination: CursorPaginationDto,
  ) {
    await this.assertVisible(targetUserId, viewerId);

    const rows = await this.prisma.post.findMany({
      where: { userId: targetUserId, deletedAt: null },
      include: POST_WITH_RELATIONS_INCLUDE,
      ...buildCursorArgs(pagination),
    });
    const { items, nextCursor } = toCursorPage(rows, pagination.limit);
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

  async deletePost(userId: number, postId: number): Promise<void> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException('Post not found');
    }
    if (post.userId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }
    await this.prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
  }

  /** Throws if the target's posts aren't visible to the viewer (private account, not followed, not self). */
  private async assertVisible(
    targetUserId: number,
    viewerId: number,
  ): Promise<void> {
    if (targetUserId === viewerId) return;

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target || target.deletedAt) {
      throw new NotFoundException('User not found');
    }
    if (!target.isPrivate) return;

    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: viewerId,
          followingId: targetUserId,
        },
      },
    });
    if (follow?.status !== FollowStatus.accepted) {
      throw new ForbiddenException('This account is private');
    }
  }
}
