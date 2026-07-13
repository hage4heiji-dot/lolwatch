-- AlterTable: videoUrl/imageUrlを単一のreferenceUrlに統合
ALTER TABLE "Report" ADD COLUMN     "referenceUrl" TEXT;

UPDATE "Report" SET "referenceUrl" = COALESCE("videoUrl", "imageUrl");

ALTER TABLE "Report" DROP COLUMN "videoUrl";
ALTER TABLE "Report" DROP COLUMN "imageUrl";
