import { CursorPage, CursorPaginationDto } from '../dto/cursor-pagination.dto';

/**
 * Every list endpoint in this codebase orders by `createdAt desc, id desc` (id as a
 * tiebreaker since createdAt alone isn't unique) and cursors on the row id, using
 * Prisma's keyset `cursor` + `skip: 1` against that same ordering.
 */
export function buildCursorArgs(pagination: CursorPaginationDto) {
  return {
    take: pagination.limit + 1,
    ...(pagination.cursor !== undefined
      ? { skip: 1, cursor: { id: pagination.cursor } }
      : {}),
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
  };
}

/** Turns a fetch of `limit + 1` rows into a page, using the extra row only to detect "more". */
export function toCursorPage<T extends { id: number }>(
  rows: T[],
  limit: number,
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;
  return { items, nextCursor };
}

/**
 * Cursor pagination over an already-sorted in-memory array, for the few list endpoints
 * (conversations, ranked by last-message time) whose ordering can't be expressed as a
 * plain Prisma `orderBy` and where the per-user dataset is small enough to sort in app code.
 */
export function paginateArray<T extends { id: number }>(
  sorted: T[],
  cursor: number | undefined,
  limit: number,
): CursorPage<T> {
  const startIndex =
    cursor !== undefined
      ? sorted.findIndex((item) => item.id === cursor) + 1
      : 0;
  const page = sorted.slice(startIndex, startIndex + limit + 1);
  return toCursorPage(page, limit);
}
