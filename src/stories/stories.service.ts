import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FollowStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../media/cloudinary.service';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { buildCursorArgs, toCursorPage } from '../common/utils/pagination.util';
import {
  toUserSummary,
  USER_SUMMARY_SELECT,
  UserSummary,
} from '../common/utils/user-summary.util';
import { CreateStoryDto } from './dto/create-story.dto';

export interface StoryItem {
  id: number;
  mediaType: string;
  cdnUrl: string;
  viewCount: number;
  createdAt: Date;
  expiresAt: Date;
  viewed: boolean;
}

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async create(userId: number, dto: CreateStoryDto) {
    const signed = this.cloudinary.createSignedUpload(
      'stories',
      userId,
      dto.mediaType,
    );

    const story = await this.prisma.story.create({
      data: {
        userId,
        mediaType: dto.mediaType,
        storageKey: signed.publicId,
        cdnUrl: signed.cdnUrl,
        expiresAt: new Date(Date.now() + STORY_TTL_MS),
      },
    });

    return { storyId: story.id, expiresAt: story.expiresAt, ...signed };
  }

  /** Active stories from people the viewer follows, plus their own, grouped by author. */
  async getFeed(viewerId: number) {
    const following = await this.prisma.follow.findMany({
      where: { followerId: viewerId, status: FollowStatus.accepted },
      select: { followingId: true },
    });
    const authorIds = [viewerId, ...following.map((f) => f.followingId)];

    const stories = await this.prisma.story.findMany({
      where: {
        userId: { in: authorIds },
        isActive: true,
        expiresAt: { gt: new Date() },
        user: {
          deletedAt: null,
          deactivatedAt: null,
          mutedMe: { none: { muterId: viewerId, muteStories: true } },
        },
      },
      include: { user: { select: USER_SUMMARY_SELECT } },
      orderBy: { createdAt: 'asc' },
    });

    const viewedStoryIds = new Set(
      (
        await this.prisma.storyView.findMany({
          where: { viewerId, storyId: { in: stories.map((s) => s.id) } },
          select: { storyId: true },
        })
      ).map((v) => v.storyId),
    );

    const grouped = new Map<
      number,
      { author: UserSummary; stories: StoryItem[] }
    >();
    for (const story of stories) {
      if (!grouped.has(story.userId)) {
        grouped.set(story.userId, {
          author: toUserSummary(story.user),
          stories: [],
        });
      }
      grouped.get(story.userId)!.stories.push({
        id: story.id,
        mediaType: story.mediaType,
        cdnUrl: story.cdnUrl,
        viewCount: story.viewCount,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        viewed: viewedStoryIds.has(story.id),
      });
    }

    // Authors with an unviewed story first, matching the usual "unseen stories float to the front" UX.
    return [...grouped.values()].sort((a, b) => {
      const aUnseen = a.stories.some((s) => !s.viewed);
      const bUnseen = b.stories.some((s) => !s.viewed);
      return aUnseen === bUnseen ? 0 : aUnseen ? -1 : 1;
    });
  }

  async view(viewerId: number, storyId: number): Promise<void> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
    });
    if (!story || !story.isActive || story.expiresAt < new Date()) {
      throw new NotFoundException('Story not found');
    }
    await this.assertVisible(story.userId, viewerId);

    if (viewerId === story.userId) return;

    try {
      await this.prisma.$transaction([
        this.prisma.storyView.create({ data: { storyId, viewerId } }),
        this.prisma.story.update({
          where: { id: storyId },
          data: { viewCount: { increment: 1 } },
        }),
      ]);
    } catch {
      // Unique constraint on (storyId, viewerId): already viewed, no-op.
    }
  }

  async getViewers(
    ownerId: number,
    storyId: number,
    pagination: CursorPaginationDto,
  ) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
    });
    if (!story) {
      throw new NotFoundException('Story not found');
    }
    if (story.userId !== ownerId) {
      throw new ForbiddenException('Only the story owner can see its viewers');
    }

    const rows = await this.prisma.storyView.findMany({
      where: { storyId },
      include: { viewer: { select: USER_SUMMARY_SELECT } },
      ...buildCursorArgs(pagination),
    });
    const { items, nextCursor } = toCursorPage(rows, pagination.limit);
    return {
      items: items.map((r) => ({
        ...toUserSummary(r.viewer),
        viewedAt: r.viewedAt,
      })),
      nextCursor,
    };
  }

  private async assertVisible(
    authorId: number,
    viewerId: number,
  ): Promise<void> {
    if (authorId === viewerId) return;
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
    });
    if (author?.deletedAt || author?.deactivatedAt) {
      throw new NotFoundException('Story not found');
    }
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
}
