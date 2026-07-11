-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('VERBAL_ABUSE', 'HATE_SPEECH', 'INTENTIONAL_FEEDING', 'AFK_LEAVING', 'CHEATING', 'SMURFING', 'ACCOUNT_TRADING');

-- CreateEnum
CREATE TYPE "ModeratorVerdict" AS ENUM ('VIOLATION_CONFIRMED', 'NO_VIOLATION', 'INSUFFICIENT_EVIDENCE');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "puuid" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerNameHistory" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "riotIdName" TEXT NOT NULL,
    "riotIdTagLine" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PlayerNameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "category" "ReportCategory" NOT NULL,
    "replayUrl" TEXT,
    "deviceId" TEXT NOT NULL,
    "posterIp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hiddenAt" TIMESTAMP(3),
    "hiddenReason" TEXT,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Moderator" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Moderator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeratorReview" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "verdict" "ModeratorVerdict" NOT NULL,
    "rationale" TEXT NOT NULL,
    "reviewedReplayUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModeratorReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankActivityCheck" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActiveInRanked" BOOLEAN NOT NULL,
    "lastRankedMatchAt" TIMESTAMP(3),

    CONSTRAINT "RankActivityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_puuid_key" ON "Player"("puuid");

-- CreateIndex
CREATE INDEX "Player_platform_idx" ON "Player"("platform");

-- CreateIndex
CREATE INDEX "PlayerNameHistory_riotIdName_riotIdTagLine_idx" ON "PlayerNameHistory"("riotIdName", "riotIdTagLine");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerNameHistory_playerId_riotIdName_riotIdTagLine_key" ON "PlayerNameHistory"("playerId", "riotIdName", "riotIdTagLine");

-- CreateIndex
CREATE INDEX "Report_playerId_createdAt_idx" ON "Report"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_deviceId_createdAt_idx" ON "Report"("deviceId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_posterIp_createdAt_idx" ON "Report"("posterIp", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Moderator_username_key" ON "Moderator"("username");

-- CreateIndex
CREATE INDEX "ModeratorReview_playerId_createdAt_idx" ON "ModeratorReview"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "RankActivityCheck_playerId_checkedAt_idx" ON "RankActivityCheck"("playerId", "checkedAt");

-- AddForeignKey
ALTER TABLE "PlayerNameHistory" ADD CONSTRAINT "PlayerNameHistory_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratorReview" ADD CONSTRAINT "ModeratorReview_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratorReview" ADD CONSTRAINT "ModeratorReview_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "Moderator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankActivityCheck" ADD CONSTRAINT "RankActivityCheck_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

