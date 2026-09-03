import { Prisma, PrismaClient } from '@prisma/client';
import {
  toUserSummary,
  USER_SUMMARY_SELECT,
} from '../common/utils/user-summary.util';

export const POST_WITH_RELATIONS_INCLUDE = {
  user: { select: USER_SUMMARY_SELECT },
  media: { orderBy: { orderIndex: 'asc' as const } },
} satisfies Prisma.PostInclude;

export type PostWithRelations = Prisma.PostGetPayload<{
  include: typeof POST_WITH_RELATIONS_INCLUDE;
}>;

export function toPostSummary(
  post: PostWithRelations,
  opts: { isLiked: boolean; isSaved: boolean },
) {
  return {
    id: post.id,
    caption: post.caption,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    createdAt: post.createdAt,
    author: toUserSummary(post.user),
    media: post.media.map((m) => ({
      id: m.id,
      mediaType: m.mediaType,
      cdnUrl: m.cdnUrl,
      width: m.width,
      height: m.height,
      orderIndex: m.orderIndex,
    })),
    isLiked: opts.isLiked,
    isSaved: opts.isSaved,
  };
}

/** Batches the "did this viewer like/save these posts" lookups so list endpoints don't run N+1 queries. */
export async function getLikedPostIds(
  prisma: PrismaClient,
  viewerId: number,
  postIds: number[],
): Promise<Set<number>> {
  if (postIds.length === 0) return new Set();
  const rows = await prisma.like.findMany({
    where: { userId: viewerId, targetType: 'post', targetId: { in: postIds } },
    select: { targetId: true },
  });
  return new Set(rows.map((r) => r.targetId));
}

export async function getSavedPostIds(
  prisma: PrismaClient,
  viewerId: number,
  postIds: number[],
): Promise<Set<number>> {
  if (postIds.length === 0) return new Set();
  const rows = await prisma.savedPost.findMany({
    where: { userId: viewerId, postId: { in: postIds } },
    select: { postId: true },
  });
  return new Set(rows.map((r) => r.postId));
}
