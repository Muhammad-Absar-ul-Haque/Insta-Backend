import { Prisma, PrismaClient } from '@prisma/client';
import {
  toUserSummary,
  USER_SUMMARY_SELECT,
} from '../common/utils/user-summary.util';

export const REEL_WITH_RELATIONS_INCLUDE = {
  user: { select: USER_SUMMARY_SELECT },
} satisfies Prisma.ReelInclude;

export type ReelWithRelations = Prisma.ReelGetPayload<{
  include: typeof REEL_WITH_RELATIONS_INCLUDE;
}>;

export function toReelSummary(reel: ReelWithRelations, isLiked: boolean) {
  return {
    id: reel.id,
    caption: reel.caption,
    cdnUrl: reel.cdnUrl,
    durationSeconds: reel.durationSeconds,
    likeCount: reel.likeCount,
    commentCount: reel.commentCount,
    viewCount: reel.viewCount,
    createdAt: reel.createdAt,
    author: toUserSummary(reel.user),
    isLiked,
  };
}

export async function getLikedReelIds(
  prisma: PrismaClient,
  viewerId: number,
  reelIds: number[],
): Promise<Set<number>> {
  if (reelIds.length === 0) return new Set();
  const rows = await prisma.like.findMany({
    where: { userId: viewerId, targetType: 'reel', targetId: { in: reelIds } },
    select: { targetId: true },
  });
  return new Set(rows.map((r) => r.targetId));
}
