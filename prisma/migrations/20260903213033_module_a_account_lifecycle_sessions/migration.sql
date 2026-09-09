-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deactivated_at" TIMESTAMP(3),
ADD COLUMN     "last_active_at" TIMESTAMP(3),
ADD COLUMN     "show_activity_status" BOOLEAN NOT NULL DEFAULT true;
