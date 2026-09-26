import { prisma } from "@/lib/prisma";
import { memoizeWithTtl } from "@/lib/ttlCache";

// トップページの「ランク参加監視」の集計。scripts/check-rank-activity.ts が6時間ごとに
// 記録するRankActivityCheckの、プレイヤーごとの最新結果から数える。
//
// - 監視人数: 公開中(非表示でない)の通報があるプレイヤー数
// - トロール撲滅数: 最新の通報以降、一度もランクマッチに出場していないプレイヤー数。
//   通報直後はほぼ全員が「未出場」になってしまうため、最新の通報から
//   MIN_DAYS_SINCE_REPORT日以上経ったプレイヤーだけを数える。
export const MIN_DAYS_SINCE_REPORT = Number(process.env.RANK_CHECK_WINDOW_DAYS ?? "3");
const CACHE_TTL_MS = 5 * 60 * 1000;

export type RankWatchStats = {
  monitoredCount: number;
  eradicatedCount: number;
  lastCheckedAt: Date | null;
  minDaysSinceReport: number;
};

async function computeRankWatchStats(): Promise<RankWatchStats> {
  const players = await prisma.player.findMany({
    where: { reports: { some: { hiddenAt: null } } },
    select: {
      reports: {
        where: { hiddenAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      rankActivity: {
        orderBy: { checkedAt: "desc" },
        take: 1,
        select: { checkedAt: true, hasRankedSinceReport: true },
      },
    },
  });

  const threshold = new Date(Date.now() - MIN_DAYS_SINCE_REPORT * 24 * 60 * 60 * 1000);
  let eradicatedCount = 0;
  let lastCheckedAt: Date | null = null;
  for (const player of players) {
    const check = player.rankActivity[0];
    if (!check) continue;
    if (!lastCheckedAt || check.checkedAt > lastCheckedAt) lastCheckedAt = check.checkedAt;
    // 最新チェック後に新しい通報が来ていても、「古い通報以降に未出場」なら
    // 「新しい通報以降も未出場」なので、そのまま数えてよい。
    const latestReportAt = player.reports[0]?.createdAt;
    if (check.hasRankedSinceReport === false && latestReportAt && latestReportAt <= threshold) {
      eradicatedCount += 1;
    }
  }

  return {
    monitoredCount: players.length,
    eradicatedCount,
    lastCheckedAt,
    minDaysSinceReport: MIN_DAYS_SINCE_REPORT,
  };
}

export const getRankWatchStats = memoizeWithTtl(computeRankWatchStats, CACHE_TTL_MS);
