-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "reel_id" INTEGER,
ALTER COLUMN "post_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "reels" ADD COLUMN     "comments_disabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "comments_reel_id_created_at_idx" ON "comments"("reel_id", "created_at");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_reel_id_fkey" FOREIGN KEY ("reel_id") REFERENCES "reels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
