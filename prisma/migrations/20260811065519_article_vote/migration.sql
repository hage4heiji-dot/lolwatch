-- CreateEnum
CREATE TYPE "ArticleVoteType" AS ENUM ('VIOLATION', 'NOT_VIOLATION');

-- CreateTable
CREATE TABLE "ArticleVote" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "voteType" "ArticleVoteType" NOT NULL,
    "deviceId" TEXT NOT NULL,
    "posterIp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleVote_articleId_voteType_idx" ON "ArticleVote"("articleId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleVote_articleId_deviceId_key" ON "ArticleVote"("articleId", "deviceId");

-- AddForeignKey
ALTER TABLE "ArticleVote" ADD CONSTRAINT "ArticleVote_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
