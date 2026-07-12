-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('LIKE', 'DISLIKE');

-- CreateTable
CREATE TABLE "ReportVote" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "deviceId" TEXT NOT NULL,
    "posterIp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewObjection" (
    "id" TEXT NOT NULL,
    "moderatorReviewId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "posterIp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewObjection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportVote_reportId_voteType_idx" ON "ReportVote"("reportId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "ReportVote_reportId_deviceId_key" ON "ReportVote"("reportId", "deviceId");

-- CreateIndex
CREATE INDEX "ReviewObjection_moderatorReviewId_idx" ON "ReviewObjection"("moderatorReviewId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewObjection_moderatorReviewId_deviceId_key" ON "ReviewObjection"("moderatorReviewId", "deviceId");

-- AddForeignKey
ALTER TABLE "ReportVote" ADD CONSTRAINT "ReportVote_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewObjection" ADD CONSTRAINT "ReviewObjection_moderatorReviewId_fkey" FOREIGN KEY ("moderatorReviewId") REFERENCES "ModeratorReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
