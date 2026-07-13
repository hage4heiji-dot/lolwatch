import { prisma } from "@/lib/prisma";
import { ModeratorVerdict, Prisma, ReportCategory } from "@/generated/prisma";
import { PeriodFilter, periodFilterSince } from "@/lib/periodFilter";

// 通報のいいね/悪いね、モデレーター評価の異議件数はJS側でvotes/objections配列から
// 集計する(種別ごとの件数はPrismaの_count.selectでは同一リレーションに複数条件を
// 持たせられないため)。件数的に多くならない想定なので全件取得で十分。
//
// includeHidden: モデレーター画面用。非表示にされた通報も含めて取得する
// (公開プレイヤーページでは絶対にtrueにしないこと)。
export async function findPlayerByPuuid(puuid: string, options?: { includeHidden?: boolean }) {
  const includeHidden = options?.includeHidden ?? false;
  return prisma.player.findUnique({
    where: { puuid },
    include: {
      nameHistory: { orderBy: { firstSeenAt: "desc" } },
      reports: {
        where: includeHidden ? {} : { hiddenAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          category: true,
          incidentTimestampSeconds: true,
          comment: true,
          referenceUrl: true,
          matchId: true,
          championName: true,
          queueId: true,
          createdAt: true,
          hiddenAt: true,
          hiddenReason: true,
          // 投稿者本人による編集可否をサーバー側で判定するためだけに使う。
          // クライアントには絶対に渡さないこと。
          deviceId: true,
          votes: true,
          moderatorReviews: {
            orderBy: { createdAt: "desc" },
            include: {
              moderator: { select: { displayName: true } },
              objections: true,
            },
          },
        },
      },
      rankActivity: {
        orderBy: { checkedAt: "desc" },
        take: 1,
      },
    },
  });
}

// 未評価の通報(=試合)を少なくとも1件持つプレイヤーを、通報件数の多い順に返す。
export async function findPlayersNeedingReview(limit = 20) {
  const players = await prisma.player.findMany({
    where: {
      reports: { some: { moderatorReviews: { none: {} } } },
    },
    include: {
      nameHistory: { where: { isCurrent: true }, take: 1 },
      _count: { select: { reports: true } },
    },
    orderBy: { reports: { _count: "desc" } },
    take: limit,
  });
  return players;
}

export type ReportedPlayersVerdictFilter = ModeratorVerdict | "UNREVIEWED";
export type ReportedPlayersSort = "reportCount" | "newest";

export const REPORTED_PLAYERS_SORT_LABELS: Record<ReportedPlayersSort, string> = {
  reportCount: "通報件数が多い順",
  newest: "新しい通報順",
};

// 公開の「通報されているユーザー一覧」ページ用。非表示にされた通報のみのプレイヤーは除外する。
// 通報件数だけでなく「最新の通報が新しい順」でも並べられるよう、まずReport.groupByで
// 対象プレイヤーIDを絞り込み・並び替えしてからページ分のPlayerを取得する
// (Prismaはto-many関係の_max集計でのorderByを親モデル側でサポートしないため)。
export async function findReportedPlayers({
  page,
  pageSize,
  query,
  category,
  verdict,
  period,
  sort = "reportCount",
}: {
  page: number;
  pageSize: number;
  query?: string;
  category?: ReportCategory;
  verdict?: ReportedPlayersVerdictFilter;
  period?: PeriodFilter;
  sort?: ReportedPlayersSort;
}) {
  const since = period ? periodFilterSince(period) : null;
  const reportFilter: Prisma.ReportWhereInput = {
    hiddenAt: null,
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(category ? { category } : {}),
    ...(verdict === "UNREVIEWED"
      ? { moderatorReviews: { none: {} } }
      : verdict
        ? { moderatorReviews: { some: { verdict } } }
        : {}),
    ...(query
      ? {
          player: {
            nameHistory: { some: { riotIdName: { contains: query, mode: "insensitive" } } },
          },
        }
      : {}),
  };

  const grouped = await prisma.report.groupBy({
    by: ["playerId"],
    where: reportFilter,
    _count: { _all: true },
    _max: { createdAt: true },
  });

  const sorted = grouped.sort((a, b) =>
    sort === "newest"
      ? (b._max.createdAt?.getTime() ?? 0) - (a._max.createdAt?.getTime() ?? 0)
      : b._count._all - a._count._all,
  );

  const totalCount = sorted.length;
  const pageGroups = sorted.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  const pageIds = pageGroups.map((g) => g.playerId);

  if (pageIds.length === 0) {
    return { players: [], totalCount };
  }

  const players = await prisma.player.findMany({
    where: { id: { in: pageIds } },
    include: {
      nameHistory: { where: { isCurrent: true }, take: 1 },
      // 各通報ごとの最新レビューを取得し、プレイヤーとしての最新バッジはJS側で算出する。
      reports: {
        where: { hiddenAt: null },
        select: {
          moderatorReviews: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      _count: { select: { reports: { where: { hiddenAt: null } } } },
    },
  });
  const playerById = new Map(players.map((p) => [p.id, p]));

  const playersWithLatestReview = pageIds.flatMap((id) => {
    const player = playerById.get(id);
    if (!player) return [];
    const latestReview = player.reports
      .flatMap((r) => r.moderatorReviews)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return [{ ...player, latestReview }];
  });

  return { players: playersWithLatestReview, totalCount };
}

export async function findPlayerByRiotId(riotIdName: string, riotIdTagLine: string) {
  const nameHistory = await prisma.playerNameHistory.findFirst({
    where: {
      riotIdName: { equals: riotIdName, mode: "insensitive" },
      riotIdTagLine: { equals: riotIdTagLine, mode: "insensitive" },
    },
    orderBy: { lastSeenAt: "desc" },
    include: { player: true },
  });
  return nameHistory?.player ?? null;
}
