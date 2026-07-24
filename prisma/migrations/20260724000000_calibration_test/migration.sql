-- CreateTable
CREATE TABLE "CalibrationAttempt" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "posterIp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "scenarioKey" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalibrationAttempt_deviceId_createdAt_idx" ON "CalibrationAttempt"("deviceId", "createdAt");

-- CreateIndex
CREATE INDEX "CalibrationAnswer_scenarioKey_idx" ON "CalibrationAnswer"("scenarioKey");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationAnswer_attemptId_scenarioKey_key" ON "CalibrationAnswer"("attemptId", "scenarioKey");

-- AddForeignKey
ALTER TABLE "CalibrationAnswer" ADD CONSTRAINT "CalibrationAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "CalibrationAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
