-- CreateEnum
CREATE TYPE "ArticleKind" AS ENUM ('INCIDENT', 'JUDGMENT');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN "kind" "ArticleKind" NOT NULL DEFAULT 'INCIDENT';
ALTER TABLE "Article" ALTER COLUMN "incidentDate" DROP NOT NULL;
ALTER TABLE "Article" ALTER COLUMN "severity" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Article_kind_idx" ON "Article"("kind");

-- AlterTable
ALTER TABLE "ArticleComment" ADD COLUMN "voteScoreAtPost" INTEGER;
