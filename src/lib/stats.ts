import { prisma } from "@/lib/prisma";
import { ModeratorVerdict, ReportCategory } from "@/generated/prisma";
import { CATEGORY_LABELS } from "@/lib/reportCategories";

const DAILY_TREND_DAYS = 30;

export type CategoryCount = { category: ReportCategory; count: number };
export type VerdictCount = { verdict: ModeratorVerdict | "UNREVIEWED"; count: number };
export type DailyCount = { date: string; count: number };
export type NamedCount = { name: string; count: number };
export type TopPlayer = {
  puuid: string;
  displayName: string;
  count: number;
};

export async function getOverviewStats() {
  const [totalReports, reportedPlayerCount, reviewedReportCount, violationConfirmedCount] =
    await Promise.all([
      prisma.report.count({ where: { hiddenAt: null } }),
      prisma.player.count({ where: { reports: { some: { hiddenAt: null } } } }),
      prisma.report.count({
        where: { hiddenAt: null, moderatorReviews: { some: {} } },
      }),
      prisma.report.count({
        where: {
          hiddenAt: null,
          moderatorReviews: { some: { verdict: ModeratorVerdict.VIOLATION_CONFIRMED } },
        },
      }),
    ]);

  return { totalReports, reportedPlayerCount, reviewedReportCount, violationConfirmedCount };
}

export async function getCategoryBreakdown(): Promise<CategoryCount[]> {
  const grouped = await prisma.report.groupBy({
    by: ["category"],
    where: { hiddenAt: null },
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
export async function getVerdictBreakdown(): Promise<VerdictCount[]> {
  const reports = await prisma.report.findMany({
    where: { hiddenAt: null },
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

export async function getTopChampions(limit = 10): Promise<NamedCount[]> {
  const grouped = await prisma.report.groupBy({
    by: ["championName"],
    where: { hiddenAt: null },
    _count: { _all: true },
    orderBy: { _count: { championName: "desc" } },
    take: limit,
  });
  return grouped.map((g) => ({ name: g.championName, count: g._count._all }));
}

export async function getTopReportedPlayers(limit = 10): Promise<TopPlayer[]> {
  const players = await prisma.player.findMany({
    where: { reports: { some: { hiddenAt: null } } },
    include: {
      nameHistory: { where: { isCurrent: true }, take: 1 },
      _count: { select: { reports: { where: { hiddenAt: null } } } },
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
