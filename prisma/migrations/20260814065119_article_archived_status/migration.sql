-- AlterTable
ALTER TABLE "Article" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Article_archivedAt_idx" ON "Article"("archivedAt");
