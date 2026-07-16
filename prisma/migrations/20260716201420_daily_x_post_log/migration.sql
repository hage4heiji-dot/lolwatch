-- CreateTable
CREATE TABLE "DailyXPost" (
    "id" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyXPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyXPost_dateKey_key" ON "DailyXPost"("dateKey");
