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
export type SortDirection = "asc" | "desc";

export const REPORTED_PLAYERS_SORT_LABELS: Record<ReportedPlayersSort, string> = {
  reportCount: "通報件数",
  newest: "最新の通報日時",
};

function buildReportFilter({
  since,
  category,
  verdict,
  query,
}: {
  since: Date | null;
  category?: ReportCategory;
  verdict?: ReportedPlayersVerdictFilter;
  query?: string;
}): Prisma.ReportWhereInput {
  return {
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
}

// 一覧のページ件数とは別に「該当する通報対象プレイヤーの総数」が必要(ページング表示用)。
// groupByで全件取得してJS側で数えると対象プレイヤー数に比例して重くなるため、
// COUNT(DISTINCT ...)を生SQLでDBに計算させ、アプリ側には件数1行だけを転送する。
async function countDistinctReportedPlayers({
  since,
  category,
  verdict,
  query,
}: {
  since: Date | null;
  category?: ReportCategory;
  verdict?: ReportedPlayersVerdictFilter;
  query?: string;
}): Promise<number> {
  const conditions: Prisma.Sql[] = [Prisma.sql`r."hiddenAt" IS NULL`];
  if (since) conditions.push(Prisma.sql`r."createdAt" >= ${since}`);
  if (category) conditions.push(Prisma.sql`r."category" = ${category}::"ReportCategory"`);
  if (verdict === "UNREVIEWED") {
    conditions.push(
      Prisma.sql`NOT EXISTS (SELECT 1 FROM "ModeratorReview" mr WHERE mr."reportId" = r.id)`,
    );
  } else if (verdict) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "ModeratorReview" mr WHERE mr."reportId" = r.id AND mr."verdict" = ${verdict}::"ModeratorVerdict")`,
    );
  }
  if (query) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "PlayerNameHistory" nh WHERE nh."playerId" = r."playerId" AND nh."riotIdName" ILIKE ${`%${query}%`})`,
    );
  }

  const result = await prisma.$queryRaw<{ count: bigint }[]>(
    Prisma.sql`SELECT COUNT(DISTINCT r."playerId")::bigint AS count FROM "Report" r WHERE ${Prisma.join(conditions, " AND ")}`,
  );
  return Number(result[0]?.count ?? 0);
}

// 公開の「通報されているユーザー一覧」ページ用。非表示にされた通報のみのプレイヤーは除外する。
// 通報件数・最新の通報日時どちらでも並べられるよう、Report.groupByの時点で
// orderBy+skip/takeを指定してDB側でページ分だけ絞り込む(全件をアプリ側に転送しない)。
// 総件数もCOUNT(DISTINCT)による別クエリでDB側で計算する。
export async function findReportedPlayers({
  page,
  pageSize,
  query,
  category,
  verdict,
  period,
  sort = "reportCount",
  direction = "desc",
}: {
  page: number;
  pageSize: number;
  query?: string;
  category?: ReportCategory;
  verdict?: ReportedPlayersVerdictFilter;
  period?: PeriodFilter;
  sort?: ReportedPlayersSort;
  direction?: SortDirection;
}) {
  const since = period ? periodFilterSince(period) : null;
  const reportFilter = buildReportFilter({ since, category, verdict, query });

  const [pageGroups, totalCount] = await Promise.all([
    prisma.report.groupBy({
      by: ["playerId"],
      where: reportFilter,
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy:
        sort === "newest"
          ? { _max: { createdAt: direction } }
          : { _count: { playerId: direction } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    countDistinctReportedPlayers({ since, category, verdict, query }),
  ]);

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
    },
  });
  const playerById = new Map(players.map((p) => [p.id, p]));
  const countByPlayerId = new Map(pageGroups.map((g) => [g.playerId, g._count._all]));
  const latestReportAtByPlayerId = new Map(pageGroups.map((g) => [g.playerId, g._max.createdAt]));

  const playersWithLatestReview = pageIds.flatMap((id) => {
    const player = playerById.get(id);
    if (!player) return [];
    const latestReview = player.reports
      .flatMap((r) => r.moderatorReviews)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return [
      {
        ...player,
        latestReview,
        // 現在の絞り込み条件(カテゴリ・評価・期間・検索語)に一致する通報件数/最新日時。
        reportCount: countByPlayerId.get(id) ?? 0,
        latestReportAt: latestReportAtByPlayerId.get(id) ?? null,
      },
    ];
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
