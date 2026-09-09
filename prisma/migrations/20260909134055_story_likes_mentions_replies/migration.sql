-- AlterEnum
ALTER TYPE "LikeTargetType" ADD VALUE 'story';

-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'story_reply';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "story_id" INTEGER;

-- AlterTable
ALTER TABLE "stories" ADD COLUMN     "like_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "text_elements" JSONB;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
