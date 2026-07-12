-- ModeratorReviewをPlayer単位からReport(=試合)単位の評価に変更する。

-- 新カラムをまずnullableで追加
ALTER TABLE "ModeratorReview" ADD COLUMN "reportId" TEXT;

-- 既存レビューは同じプレイヤーの直近の通報に紐付けてバックフィルする
-- (このアプリではこの時点でModeratorReviewは高々1件程度の想定)。
UPDATE "ModeratorReview" mr
SET "reportId" = (
  SELECT r.id FROM "Report" r
  WHERE r."playerId" = mr."playerId"
  ORDER BY r."createdAt" DESC
  LIMIT 1
);

-- 紐付け先の通報が存在しなかった(通報0件のプレイヤーへの評価)レビューは
-- 新しいモデルでは表現できないため削除する。
DELETE FROM "ModeratorReview" WHERE "reportId" IS NULL;

ALTER TABLE "ModeratorReview" ALTER COLUMN "reportId" SET NOT NULL;
ALTER TABLE "ModeratorReview" ADD CONSTRAINT "ModeratorReview_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "ModeratorReview_playerId_createdAt_idx";
CREATE INDEX "ModeratorReview_reportId_createdAt_idx" ON "ModeratorReview"("reportId", "createdAt");

ALTER TABLE "ModeratorReview" DROP CONSTRAINT "ModeratorReview_playerId_fkey";
ALTER TABLE "ModeratorReview" DROP COLUMN "playerId";
