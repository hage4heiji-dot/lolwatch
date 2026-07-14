import { prisma } from "@/lib/prisma";
import { ModeratorVerdict, ReportCategory } from "@/generated/prisma";
import { CATEGORY_LABELS } from "@/lib/reportCategories";

const DAILY_TREND_DAYS = 30;

function createdAtFilter(since: Date | null) {
  return since ? { createdAt: { gte: since } } : {};
}

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
  reviewedCount: number;
};

export async function getOverviewStats(since: Date | null = null) {
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

  return { totalReports, reportedPlayerCount, reviewedReportCount, violationConfirmedCount };
}

export async function getCategoryBreakdown(since: Date | null = null): Promise<CategoryCount[]> {
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

// 評価はReportではなくModeratorReviewに紐づくため、通報ごとの最新評価を
// JS側で集計する(1通報に複数レビューが付き得るため)。
export async function getVerdictBreakdown(since: Date | null = null): Promise<VerdictCount[]> {
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

export async function getDailyReportCounts(days = DAILY_TREND_DAYS): Promise<DailyCount[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const reports = await prisma.report.findMany({
    where: { hiddenAt: null, createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const counts = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    counts.set(d.toISOString().slice(0, 10), 0);
  }
  for (const report of reports) {
    const key = report.createdAt.toISOString().slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
}

export async function getTopChampions(limit = 10, since: Date | null = null): Promise<NamedCount[]> {
  const grouped = await prisma.report.groupBy({
    by: ["championName"],
    where: { hiddenAt: null, ...createdAtFilter(since) },
    _count: { _all: true },
    orderBy: { _count: { championName: "desc" } },
    take: limit,
  });
  return grouped.map((g) => ({ name: g.championName, count: g._count._all }));
}

export async function getTopReportedPlayers(
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

// ホーム画面の「要注意人物」用。指定期間内の通報について、一般ユーザーから
// 「妥当」票(LIKE)を多く集めた順に並べる(同数の場合は通報件数で補完)。
// 単純な通報件数だけだと逆恨みの連投に弱いため、コミュニティの support を優先する。
export async function getMostWatchedPlayers(
  limit = 5,
  since: Date | null = null,
): Promise<WatchedPlayer[]> {
  const reports = await prisma.report.findMany({
    where: { hiddenAt: null, ...createdAtFilter(since) },
    select: {
      playerId: true,
      votes: { select: { voteType: true } },
      moderatorReviews: { select: { id: true }, take: 1 },
    },
  });

  const tallyByPlayerId = new Map<
    string,
    { reportCount: number; validatedCount: number; invalidCount: number; reviewedCount: number }
  >();
  for (const report of reports) {
    const tally = tallyByPlayerId.get(report.playerId) ?? {
      reportCount: 0,
      validatedCount: 0,
      invalidCount: 0,
      reviewedCount: 0,
    };
    tally.reportCount += 1;
    tally.validatedCount += report.votes.filter((v) => v.voteType === "LIKE").length;
    tally.invalidCount += report.votes.filter((v) => v.voteType === "DISLIKE").length;
    if (report.moderatorReviews.length > 0) tally.reviewedCount += 1;
    tallyByPlayerId.set(report.playerId, tally);
  }

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
        reportCount: tally.reportCount,
        validatedCount: tally.validatedCount,
        invalidCount: tally.invalidCount,
        reviewedCount: tally.reviewedCount,
      },
    ];
  });
}
