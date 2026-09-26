-- AlterTable
ALTER TABLE "RankActivityCheck" ADD COLUMN     "hasRankedSinceReport" BOOLEAN,
ADD COLUMN     "sinceReportAt" TIMESTAMP(3);
