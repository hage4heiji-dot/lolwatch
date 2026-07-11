-- AlterTable
ALTER TABLE "Moderator" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ModeratorSession" (
    "id" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeratorSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModeratorSession_tokenHash_key" ON "ModeratorSession"("tokenHash");

-- CreateIndex
CREATE INDEX "ModeratorSession_moderatorId_idx" ON "ModeratorSession"("moderatorId");

-- AddForeignKey
ALTER TABLE "ModeratorSession" ADD CONSTRAINT "ModeratorSession_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "Moderator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

