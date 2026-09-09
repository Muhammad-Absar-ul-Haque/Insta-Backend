-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'video';

-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN     "request_status" "FollowStatus" NOT NULL DEFAULT 'accepted';
