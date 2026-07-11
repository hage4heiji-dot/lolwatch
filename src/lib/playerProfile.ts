import { prisma } from "@/lib/prisma";

export async function findPlayerByPuuid(puuid: string) {
  return prisma.player.findUnique({
    where: { puuid },
    include: {
      nameHistory: { orderBy: { firstSeenAt: "desc" } },
      reports: {
        where: { hiddenAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          category: true,
          incidentTimestampSeconds: true,
          comment: true,
          matchId: true,
          championName: true,
          queueId: true,
          createdAt: true,
        },
      },
      moderatorReviews: {
        orderBy: { createdAt: "desc" },
        include: { moderator: { select: { displayName: true } } },
      },
      rankActivity: {
        orderBy: { checkedAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function findPlayersNeedingReview(limit = 20) {
  const players = await prisma.player.findMany({
    where: {
      moderatorReviews: { none: {} },
      reports: { some: {} },
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

// 公開の「通報されているユーザー一覧」ページ用。非表示にされた通報のみのプレイヤーは除外する。
export async function findReportedPlayers({
  page,
  pageSize,
}: {
  page: number;
  pageSize: number;
}) {
  const where = { reports: { some: { hiddenAt: null } } };

  const [players, totalCount] = await Promise.all([
    prisma.player.findMany({
      where,
      include: {
        nameHistory: { where: { isCurrent: true }, take: 1 },
        moderatorReviews: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { reports: { where: { hiddenAt: null } } } },
      },
      orderBy: { reports: { _count: "desc" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.player.count({ where }),
  ]);

  return { players, totalCount };
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
