import { prisma } from "@/lib/prisma";
import { ModeratorVerdict, ReportCategory } from "@/generated/prisma";
import { CATEGORY_LABELS } from "@/lib/reportCategories";
import { toJstDateKey, todayJstMidnightUtc } from "@/lib/jstDate";
import { TIER_LABELS } from "@/lib/rankLabel";
import { memoizeWithTtlByKey } from "@/lib/ttlCache";

const DAILY_TREND_DAYS = 30;

function createdAtFilter(since: Date | null) {
  return since ? { createdAt: { gte: since } } : {};
}

// periodFilterSinceはJST日付境界(todayJstMidnightUtc)基準で計算されるため、
// 同じ期間フィルタ("week"/"month"/"all")なら同日中は同じミリ秒値になり、
// キャッシュキーとして安定して使える(Date.now()基準の相対計算だと
// リクエストごとに値がずれてキャッシュが効かなくなってしまう)。
function sinceKey(since: Date | null | undefined): string {
  return since ? String(since.getTime()) : "all";
}

// 統計ダッシュボードは通報件数等をDBから毎回集計し直すコストが大きく、
// 期間フィルタごとに短時間キャッシュして使い回す(calibrationStatsの
// 集計キャッシュ・プレイヤーページのRiot APIキャッシュと同じ方針)。
const DASHBOARD_STATS_CACHE_TTL_MS = 30 * 1000;

export type CategoryCount = { category: ReportCategory; count: number };
export type VerdictCount = { verdict: ModeratorVerdict | "UNREVIEWED"; count: number };
export type DailyCount = { date: string; count: number };
export type NamedCount = { name: string; count: number };
export type TopPlayer = {
  puuid: string;
  displayName: string;
  count: number;
};
export type WatchedPlayer = {
  puuid: string;
  displayName: string;
  reportCount: number;
  validatedCount: number;
  invalidCount: number;
  // 「証拠不十分」「違反なしと判断」を除いた、実質的な通報件数。
  netReportCount: number;
};

export type ReportOutcomeTally = {
  reportCount: number;
  validatedCount: number;
  invalidCount: number;
  netReportCount: number;
};

// モデレーターが「証拠不十分」または「違反なしと判断」とした通報は、悪意ある連続通報
// などによる見かけ上の件数を救済するため、実質的な通報件数から除外する。
const EXCLUDED_FROM_NET_COUNT: ModeratorVerdict[] = [
  ModeratorVerdict.NO_VIOLATION,
  ModeratorVerdict.INSUFFICIENT_EVIDENCE,
];

// 通報一覧(votes/moderatorReviewsを含む)をプレイヤー単位で集計し、通報件数・
// 妥当/不当票数・実質通報件数を算出する。ホームの「注目ユーザー」と
// ユーザー一覧の内訳表示の両方で共通して使う。
export function tallyReportOutcomes(
  reports: {
    playerId: string;
    votes: { voteType: string }[];
    moderatorReviews: { verdict: ModeratorVerdict }[];
  }[],
): Map<string, ReportOutcomeTally> {
  const tallyByPlayerId = new Map<
    string,
    { reportCount: number; validatedCount: number; invalidCount: number; excludedCount: number }
  >();
  for (const report of reports) {
    const tally = tallyByPlayerId.get(report.playerId) ?? {
      reportCount: 0,
      validatedCount: 0,
      invalidCount: 0,
      excludedCount: 0,
    };
    tally.reportCount += 1;
    tally.validatedCount += report.votes.filter((v) => v.voteType === "LIKE").length;
    tally.invalidCount += report.votes.filter((v) => v.voteType === "DISLIKE").length;
    const verdict = report.moderatorReviews[0]?.verdict;
    if (verdict && EXCLUDED_FROM_NET_COUNT.includes(verdict)) tally.excludedCount += 1;
    tallyByPlayerId.set(report.playerId, tally);
  }

  return new Map(
    Array.from(tallyByPlayerId.entries()).map(([playerId, tally]) => [
      playerId,
      {
        reportCount: tally.reportCount,
        validatedCount: tally.validatedCount,
        invalidCount: tally.invalidCount,
        netReportCount: tally.reportCount - tally.excludedCount,
      },
    ]),
  );
}

async function computeOverviewStats(since: Date | null = null) {
  const [totalReports, reportedPlayerCount, reviewedReportCount, violationConfirmedCount] =
    await Promise.all([
      prisma.report.count({ where: { hiddenAt: null, ...createdAtFilter(since) } }),
      prisma.player.count({
        where: { reports: { some: { hiddenAt: null, ...createdAtFilter(since) } } },
      }),
      prisma.report.count({
        where: { hiddenAt: null, ...createdAtFilter(since), moderatorReviews: { some: {} } },
      }),
      prisma.report.count({
        where: {
          hiddenAt: null,
          ...createdAtFilter(since),
          moderatorReviews: { some: { verdict: ModeratorVerdict.VIOLATION_CONFIRMED } },
        },
      }),
    ]);

  // 評価済みの通報のうち、実際に違反が確認された割合(通報全体の信頼性の目安)。
  const violationConfirmedRate =
    reviewedReportCount > 0 ? Math.round((violationConfirmedCount / reviewedReportCount) * 100) : null;

  return {
    totalReports,
    reportedPlayerCount,
    reviewedReportCount,
    violationConfirmedCount,
    violationConfirmedRate,
  };
}

export const getOverviewStats = memoizeWithTtlByKey(
  computeOverviewStats,
  DASHBOARD_STATS_CACHE_TTL_MS,
  (since) => sinceKey(since),
);

export type VoteTotals = { likeCount: number; dislikeCount: number };

// コミュニティ投票(「この通報は妥当/不当」)の集計。
async function computeVoteTotals(since: Date | null = null): Promise<VoteTotals> {
  const [likeCount, dislikeCount] = await Promise.all([
    prisma.reportVote.count({
      where: { voteType: "LIKE", report: { hiddenAt: null, ...createdAtFilter(since) } },
    }),
    prisma.reportVote.count({
      where: { voteType: "DISLIKE", report: { hiddenAt: null, ...createdAtFilter(since) } },
    }),
  ]);
  return { likeCount, dislikeCount };
}

export const getVoteTotals = memoizeWithTtlByKey(
  computeVoteTotals,
  DASHBOARD_STATS_CACHE_TTL_MS,
  (since) => sinceKey(since),
);

export type TierCount = { tier: string; label: string; count: number };

const TIER_ORDER = [...Object.keys(TIER_LABELS), "UNRANKED"];

// 通報された時点でのソロ/デュオランク層の分布。reportedTierが未取得(null)の
// 通報(この機能の導入以前のものなど)は対象外にする。
async function computeReportedTierBreakdown(since: Date | null = null): Promise<TierCount[]> {
  const grouped = await prisma.report.groupBy({
    by: ["reportedTier"],
    where: { hiddenAt: null, ...createdAtFilter(since), reportedTier: { not: null } },
    _count: { _all: true },
  });
  const counts = new Map(grouped.map((g) => [g.reportedTier as string, g._count._all]));

  return TIER_ORDER.map((tier) => ({
    tier,
    label: tier === "UNRANKED" ? "ランクなし" : TIER_LABELS[tier],
    count: counts.get(tier) ?? 0,
  }));
}

export const getReportedTierBreakdown = memoizeWithTtlByKey(
  computeReportedTierBreakdown,
  DASHBOARD_STATS_CACHE_TTL_MS,
  (since) => sinceKey(since),
);

async function computeCategoryBreakdown(since: Date | null = null): Promise<CategoryCount[]> {
  const grouped = await prisma.report.groupBy({
    by: ["category"],
    where: { hiddenAt: null, ...createdAtFilter(since) },
    _count: { _all: true },
  });
  const counts = new Map(grouped.map((g) => [g.category, g._count._all]));

  return (Object.keys(CATEGORY_LABELS) as ReportCategory[]).map((category) => ({
    category,
    count: counts.get(category) ?? 0,
  }));
}

export const getCategoryBreakdown = memoizeWithTtlByKey(
  computeCategoryBreakdown,
  DASHBOARD_STATS_CACHE_TTL_MS,
  (since) => sinceKey(since),
);

// 評価はReportではなくModeratorReviewに紐づくため、通報ごとの最新評価を
// JS側で集計する(1通報に複数レビューが付き得るため)。
async function computeVerdictBreakdown(since: Date | null = null): Promise<VerdictCount[]> {
  const reports = await prisma.report.findMany({
    where: { hiddenAt: null, ...createdAtFilter(since) },
    select: {
      moderatorReviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { verdict: true },
      },
    },
  });

  const counts = new Map<ModeratorVerdict | "UNREVIEWED", number>();
  for (const report of reports) {
    const key = report.moderatorReviews[0]?.verdict ?? "UNREVIEWED";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const order: (ModeratorVerdict | "UNREVIEWED")[] = [
    "UNREVIEWED",
    ModeratorVerdict.VIOLATION_CONFIRMED,
    ModeratorVerdict.NO_VIOLATION,
    ModeratorVerdict.INSUFFICIENT_EVIDENCE,
  ];
  return order.map((verdict) => ({ verdict, count: counts.get(verdict) ?? 0 }));
}

export const getVerdictBreakdown = memoizeWithTtlByKey(
  computeVerdictBreakdown,
  DASHBOARD_STATS_CACHE_TTL_MS,
  (since) => sinceKey(since),
);

async function computeDailyReportCounts(days = DAILY_TREND_DAYS): Promise<DailyCount[]> {
  const since = new Date(todayJstMidnightUtc().getTime() - (days - 1) * 24 * 60 * 60 * 1000);

  const reports = await prisma.report.findMany({
    where: { hiddenAt: null, createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const counts = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
    counts.set(toJstDateKey(d), 0);
  }
  for (const report of reports) {
    const key = toJstDateKey(report.createdAt);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
}

export const getDailyReportCounts = memoizeWithTtlByKey(
  computeDailyReportCounts,
  DASHBOARD_STATS_CACHE_TTL_MS,
  (days = DAILY_TREND_DAYS) => String(days),
);

async function computeTopChampions(
  limit = 10,
  since: Date | null = null,
): Promise<NamedCount[]> {
  const grouped = await prisma.report.groupBy({
    by: ["championName"],
    where: { hiddenAt: null, ...createdAtFilter(since) },
    _count: { _all: true },
    orderBy: { _count: { championName: "desc" } },
    take: limit,
  });
  return grouped.map((g) => ({ name: g.championName, count: g._count._all }));
}

export const getTopChampions = memoizeWithTtlByKey(
  computeTopChampions,
  DASHBOARD_STATS_CACHE_TTL_MS,
  (limit = 10, since = null) => `${limit}:${sinceKey(since)}`,
);

async function computeTopReportedPlayers(
  limit = 10,
  since: Date | null = null,
): Promise<TopPlayer[]> {
  const reportFilter = { hiddenAt: null, ...createdAtFilter(since) };
  const players = await prisma.player.findMany({
    where: { reports: { some: reportFilter } },
    include: {
      nameHistory: { where: { isCurrent: true }, take: 1 },
      _count: { select: { reports: { where: reportFilter } } },
    },
    orderBy: { reports: { _count: "desc" } },
    take: limit,
  });

  return players.map((player) => {
    const name = player.nameHistory[0];
    return {
      puuid: player.puuid,
      displayName: name ? `${name.riotIdName} #${name.riotIdTagLine}` : player.puuid,
      count: player._count.reports,
    };
  });
}

export const getTopReportedPlayers = memoizeWithTtlByKey(
  computeTopReportedPlayers,
  DASHBOARD_STATS_CACHE_TTL_MS,
  (limit = 10, since = null) => `${limit}:${sinceKey(since)}`,
);

// ホーム画面の「注目ユーザー」用。指定期間内の通報について、一般ユーザーから
// 「妥当」票(LIKE)を多く集めた順に並べる(同数の場合は通報件数で補完)。
// 単純な通報件数だけだと逆恨みの連投に弱いため、コミュニティの support を優先する。
// ホームは最もアクセスが集中するページのため、他の集計と同様に短時間キャッシュする。
async function computeMostWatchedPlayers(
  limit = 5,
  since: Date | null = null,
): Promise<WatchedPlayer[]> {
  const reports = await prisma.report.findMany({
    where: { hiddenAt: null, ...createdAtFilter(since) },
    select: {
      playerId: true,
      votes: { select: { voteType: true } },
      moderatorReviews: { orderBy: { createdAt: "desc" }, take: 1, select: { verdict: true } },
    },
  });

  const tallyByPlayerId = tallyReportOutcomes(reports);

  const topPlayerIds = Array.from(tallyByPlayerId.entries())
    .sort(([, a], [, b]) => b.validatedCount - a.validatedCount || b.reportCount - a.reportCount)
    .slice(0, limit)
    .map(([playerId]) => playerId);
  if (topPlayerIds.length === 0) return [];

  const players = await prisma.player.findMany({
    where: { id: { in: topPlayerIds } },
    include: { nameHistory: { where: { isCurrent: true }, take: 1 } },
  });
  const playerById = new Map(players.map((p) => [p.id, p]));

  return topPlayerIds.flatMap((playerId) => {
    const player = playerById.get(playerId);
    if (!player) return [];
    const tally = tallyByPlayerId.get(playerId)!;
    const name = player.nameHistory[0];
    return [
      {
        puuid: player.puuid,
        displayName: name ? `${name.riotIdName} #${name.riotIdTagLine}` : player.puuid,
        ...tally,
      },
    ];
  });
}

export const getMostWatchedPlayers = memoizeWithTtlByKey(
  computeMostWatchedPlayers,
  DASHBOARD_STATS_CACHE_TTL_MS,
  (limit = 5, since = null) => `${limit}:${sinceKey(since)}`,
);
