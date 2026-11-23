-- CreateTable
CREATE TABLE "RiotReportStat" (
    "id" TEXT NOT NULL,
    "accountKey" TEXT NOT NULL,
    "receivedTotal" INTEGER NOT NULL,
    "madeTotal" INTEGER NOT NULL,
    "receivedByCategory" JSONB NOT NULL,
    "madeByCategory" JSONB NOT NULL,
    "penaltyCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiotReportStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiotReportStat_accountKey_key" ON "RiotReportStat"("accountKey");

-- CreateIndex
CREATE INDEX "RiotReportStat_receivedTotal_idx" ON "RiotReportStat"("receivedTotal");

