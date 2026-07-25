-- CreateTable
CREATE TABLE "ReportDeletionRequest" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "posterIp" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportDeletionRequest_reportId_idx" ON "ReportDeletionRequest"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportDeletionRequest_reportId_deviceId_key" ON "ReportDeletionRequest"("reportId", "deviceId");

-- AddForeignKey
ALTER TABLE "ReportDeletionRequest" ADD CONSTRAINT "ReportDeletionRequest_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
