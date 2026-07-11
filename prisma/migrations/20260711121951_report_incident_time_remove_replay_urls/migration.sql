-- AlterTable
ALTER TABLE "Report" DROP COLUMN "replayUrl",
ADD COLUMN     "incidentTimestampSeconds" INTEGER;

-- AlterTable
ALTER TABLE "ModeratorReview" DROP COLUMN "reviewedReplayUrl";
