import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface DayCount {
  day: Date;
  count: bigint;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const now = new Date();
    const since24h = new Date(now.getTime() - DAY_MS);
    const since30d = new Date(now.getTime() - 30 * DAY_MS);
    const since7d = new Date(now.getTime() - 7 * DAY_MS);

    const [totalUsers, totalPosts, totalReels, dau, mau, signupsLast7Days] =
      await Promise.all([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.post.count({ where: { deletedAt: null } }),
        this.prisma.reel.count({ where: { deletedAt: null } }),
        this.prisma.user.count({ where: { lastLoginAt: { gte: since24h } } }),
        this.prisma.user.count({ where: { lastLoginAt: { gte: since30d } } }),
        this.prisma.user.count({ where: { createdAt: { gte: since7d } } }),
      ]);

    return {
      totalUsers,
      totalPosts,
      totalReels,
      // DAU/MAU are approximated from lastLoginAt (a point-in-time field), not a
      // session/event log, so treat these as directional rather than exact.
      dailyActiveUsers: dau,
      monthlyActiveUsers: mau,
      signupsLast7Days,
    };
  }

  async growth(days: number) {
    const rows = await this.prisma.$queryRaw<DayCount[]>`
      SELECT date_trunc('day', "created_at") AS day, COUNT(*)::bigint AS count
      FROM users
      WHERE "created_at" >= NOW() - (${days}::int * INTERVAL '1 day')
      GROUP BY day
      ORDER BY day ASC
    `;
    return this.fillDays(rows, days);
  }

  async engagement(days: number) {
    const [posts, likes, comments] = await Promise.all([
      this.prisma.$queryRaw<DayCount[]>`
        SELECT date_trunc('day', "created_at") AS day, COUNT(*)::bigint AS count
        FROM posts WHERE "created_at" >= NOW() - (${days}::int * INTERVAL '1 day')
        GROUP BY day ORDER BY day ASC
      `,
      this.prisma.$queryRaw<DayCount[]>`
        SELECT date_trunc('day', "created_at") AS day, COUNT(*)::bigint AS count
        FROM likes WHERE "created_at" >= NOW() - (${days}::int * INTERVAL '1 day')
        GROUP BY day ORDER BY day ASC
      `,
      this.prisma.$queryRaw<DayCount[]>`
        SELECT date_trunc('day', "created_at") AS day, COUNT(*)::bigint AS count
        FROM comments WHERE "created_at" >= NOW() - (${days}::int * INTERVAL '1 day')
        GROUP BY day ORDER BY day ASC
      `,
    ]);

    const postsByDay = this.fillDays(posts, days);
    const likesByDay = this.fillDays(likes, days);
    const commentsByDay = this.fillDays(comments, days);

    return postsByDay.map((p, i) => ({
      date: p.date,
      posts: p.count,
      likes: likesByDay[i].count,
      comments: commentsByDay[i].count,
    }));
  }

  /** Raw GROUP BY only returns days that had activity; zero-fill the rest so the
   * response is a contiguous series a chart can plot directly. */
  private fillDays(
    rows: DayCount[],
    days: number,
  ): { date: string; count: number }[] {
    const byDay = new Map(
      rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]),
    );
    const result: { date: string; count: number }[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today.getTime() - i * DAY_MS)
        .toISOString()
        .slice(0, 10);
      result.push({ date, count: byDay.get(date) ?? 0 });
    }
    return result;
  }
}
