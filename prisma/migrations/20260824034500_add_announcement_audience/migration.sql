-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('RESTAURANT', 'STORE', 'ALL');
-- AlterTable
ALTER TABLE "platform_announcements" ADD COLUMN     "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL';
