-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleComment" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "posterIp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hiddenAt" TIMESTAMP(3),
    "hiddenReason" TEXT,

    CONSTRAINT "ArticleComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleCommentReport" (
    "id" TEXT NOT NULL,
    "articleCommentId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "posterIp" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleCommentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Article_publishedAt_createdAt_idx" ON "Article"("publishedAt", "createdAt");

-- CreateIndex
CREATE INDEX "ArticleComment_articleId_createdAt_idx" ON "ArticleComment"("articleId", "createdAt");

-- CreateIndex
CREATE INDEX "ArticleComment_deviceId_createdAt_idx" ON "ArticleComment"("deviceId", "createdAt");

-- CreateIndex
CREATE INDEX "ArticleComment_posterIp_createdAt_idx" ON "ArticleComment"("posterIp", "createdAt");

-- CreateIndex
CREATE INDEX "ArticleCommentReport_articleCommentId_idx" ON "ArticleCommentReport"("articleCommentId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleCommentReport_articleCommentId_deviceId_key" ON "ArticleCommentReport"("articleCommentId", "deviceId");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "Moderator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleComment" ADD CONSTRAINT "ArticleComment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCommentReport" ADD CONSTRAINT "ArticleCommentReport_articleCommentId_fkey" FOREIGN KEY ("articleCommentId") REFERENCES "ArticleComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
