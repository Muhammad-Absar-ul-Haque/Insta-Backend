-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "is_filtered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_pinned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "comments_disabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "blocked_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
