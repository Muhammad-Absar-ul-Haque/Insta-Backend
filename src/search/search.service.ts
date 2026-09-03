import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  toUserSummary,
  USER_SUMMARY_SELECT,
} from '../common/utils/user-summary.util';

const RESULTS_PER_SECTION = 10;

/**
 * Basic `ILIKE`-backed search (Postgres full-text `tsvector`/GIN, or an Elasticsearch
 * index keyed by username/tag, is the natural upgrade path once result relevance and
 * query volume outgrow this). No location search: there's no location data modeled
 * anywhere else in this backend, so that part of the spec's search surface is out of
 * scope rather than a plausible stub.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string) {
    const [users, hashtags] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { fullName: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: USER_SUMMARY_SELECT,
        take: RESULTS_PER_SECTION,
      }),
      this.prisma.hashtag.findMany({
        where: {
          tag: { contains: query.replace(/^#/, ''), mode: 'insensitive' },
          isBlocked: false,
        },
        orderBy: { postCount: 'desc' },
        take: RESULTS_PER_SECTION,
      }),
    ]);

    return {
      users: users.map(toUserSummary),
      hashtags: hashtags.map((h) => ({ tag: h.tag, postCount: h.postCount })),
    };
  }
}
