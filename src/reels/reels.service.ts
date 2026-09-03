import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../media/s3.service';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { toCursorPage } from '../common/utils/pagination.util';
import {
  getLikedReelIds,
  REEL_WITH_RELATIONS_INCLUDE,
  toReelSummary,
} from './reels.util';
import { CreateReelDto } from './dto/create-reel.dto';

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

@Injectable()
export class ReelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async create(userId: number, dto: CreateReelDto) {
    const extension = CONTENT_TYPE_EXTENSION[dto.contentType];
    const storageKey = this.s3.buildKey('reels', userId, extension);
    const { uploadUrl, cdnUrl } = await this.s3.createPresignedUpload(
      storageKey,
      dto.contentType,
    );

    const reel = await this.prisma.reel.create({
      data: {
        userId,
        caption: dto.caption,
        storageKey,
        cdnUrl,
        durationSeconds: dto.durationSeconds,
      },
      include: REEL_WITH_RELATIONS_INCLUDE,
    });

    return { reel: toReelSummary(reel, false), uploadUrl };
  }

  /** Basic engagement ranking (likes, then views, then recency) over recent reels. */
  async getFeed(viewerId: number, pagination: CursorPaginationDto) {
    const rows = await this.prisma.reel.findMany({
      where: { deletedAt: null },
      include: REEL_WITH_RELATIONS_INCLUDE,
      take: pagination.limit + 1,
      ...(pagination.cursor
        ? { skip: 1, cursor: { id: pagination.cursor } }
        : {}),
      orderBy: [
        { likeCount: 'desc' },
        { viewCount: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });

    const { items, nextCursor } = toCursorPage(rows, pagination.limit);
    const likedIds = await getLikedReelIds(
      this.prisma,
      viewerId,
      items.map((r) => r.id),
    );
    return {
      items: items.map((reel) => toReelSummary(reel, likedIds.has(reel.id))),
      nextCursor,
    };
  }

  async view(reelId: number): Promise<void> {
    const result = await this.prisma.reel.updateMany({
      where: { id: reelId, deletedAt: null },
      data: { viewCount: { increment: 1 } },
    });
    if (result.count === 0) {
      throw new NotFoundException('Reel not found');
    }
  }
}
