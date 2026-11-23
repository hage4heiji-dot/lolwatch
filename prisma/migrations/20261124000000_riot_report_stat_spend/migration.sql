-- LoLのRP購入履歴の合計額(円)と購入回数
ALTER TABLE "RiotReportStat" ADD COLUMN "spendYen" INTEGER,
ADD COLUMN "spendPurchases" INTEGER;
