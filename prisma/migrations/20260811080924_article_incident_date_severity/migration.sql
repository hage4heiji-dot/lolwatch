-- CreateEnum
CREATE TYPE "ArticleSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
-- 既存行のバックフィル用に一時的にDEFAULTを付け、反映後は外す
-- (アプリ側は常に値を指定する前提で、DBのDEFAULTには依存しない)。
ALTER TABLE "Article" ADD COLUMN "incidentDate" DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE "Article" ALTER COLUMN "incidentDate" DROP DEFAULT;

ALTER TABLE "Article" ADD COLUMN "severity" "ArticleSeverity" NOT NULL DEFAULT 'LOW';
ALTER TABLE "Article" ALTER COLUMN "severity" DROP DEFAULT;

-- DropIndex
DROP INDEX "Article_publishedAt_createdAt_idx";

-- CreateIndex
CREATE INDEX "Article_publishedAt_incidentDate_idx" ON "Article"("publishedAt", "incidentDate");
