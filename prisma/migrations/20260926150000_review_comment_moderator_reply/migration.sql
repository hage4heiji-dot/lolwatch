-- AlterTable
ALTER TABLE "ReviewComment" ADD COLUMN     "moderatorId" TEXT,
ADD COLUMN     "parentId" TEXT,
ALTER COLUMN "deviceId" DROP NOT NULL,
ALTER COLUMN "posterIp" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ReviewComment_parentId_idx" ON "ReviewComment"("parentId");

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "Moderator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ReviewComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
