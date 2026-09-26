-- CreateTable
CREATE TABLE "ReviewComment" (
    "id" TEXT NOT NULL,
    "moderatorReviewId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "posterIp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hiddenAt" TIMESTAMP(3),
    "hiddenReason" TEXT,

    CONSTRAINT "ReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewCommentReport" (
    "id" TEXT NOT NULL,
    "reviewCommentId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "posterIp" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewCommentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewComment_moderatorReviewId_createdAt_idx" ON "ReviewComment"("moderatorReviewId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewComment_deviceId_createdAt_idx" ON "ReviewComment"("deviceId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewComment_posterIp_createdAt_idx" ON "ReviewComment"("posterIp", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewCommentReport_reviewCommentId_idx" ON "ReviewCommentReport"("reviewCommentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewCommentReport_reviewCommentId_deviceId_key" ON "ReviewCommentReport"("reviewCommentId", "deviceId");

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_moderatorReviewId_fkey" FOREIGN KEY ("moderatorReviewId") REFERENCES "ModeratorReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCommentReport" ADD CONSTRAINT "ReviewCommentReport_reviewCommentId_fkey" FOREIGN KEY ("reviewCommentId") REFERENCES "ReviewComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
