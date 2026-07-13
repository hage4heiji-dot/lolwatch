import { prisma } from "@/lib/prisma";
import { ModeratorVerdict, Prisma, ReportCategory } from "@/generated/prisma";

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
          videoUrl: true,
          imageUrl: true,
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

// 公開の「通報されているユーザー一覧」ページ用。非表示にされた通報のみのプレイヤーは除外する。
export async function findReportedPlayers({
  page,
  pageSize,
  query,
  category,
  verdict,
}: {
  page: number;
  pageSize: number;
  query?: string;
  category?: ReportCategory;
  verdict?: ReportedPlayersVerdictFilter;
}) {
  const reportFilter: Prisma.ReportWhereInput = {
    hiddenAt: null,
    ...(category ? { category } : {}),
    ...(verdict === "UNREVIEWED"
      ? { moderatorReviews: { none: {} } }
      : verdict
        ? { moderatorReviews: { some: { verdict } } }
        : {}),
  };

  const where: Prisma.PlayerWhereInput = {
    reports: { some: reportFilter },
    ...(query
      ? {
          nameHistory: {
            some: { riotIdName: { contains: query, mode: "insensitive" } },
          },
        }
      : {}),
  };

  const [players, totalCount] = await Promise.all([
    prisma.player.findMany({
      where,
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
      orderBy: { reports: { _count: "desc" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.player.count({ where }),
  ]);

  const playersWithLatestReview = players.map((player) => {
    const latestReview = player.reports
      .flatMap((r) => r.moderatorReviews)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return { ...player, latestReview };
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
