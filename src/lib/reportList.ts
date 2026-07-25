import { prisma } from "@/lib/prisma";
import { Prisma, ReportCategory } from "@/generated/prisma";
import type { ReportedPlayersVerdictFilter } from "@/lib/playerProfile";
import { memoizeWithTtlByKey } from "@/lib/ttlCache";

export type PublicReportSort = "newest" | "oldest";

function buildFilter({
  category,
  verdict,
  query,
}: {
  category?: ReportCategory;
  verdict?: ReportedPlayersVerdictFilter;
  query?: string;
}): Prisma.ReportWhereInput {
  return {
    hiddenAt: null,
    ...(category ? { category } : {}),
    ...(verdict === "UNREVIEWED"
      ? { moderatorReviews: { none: {} } }
      : verdict
        ? { moderatorReviews: { some: { verdict } } }
        : {}),
    ...(query
      ? {
          OR: [
            { matchId: { contains: query, mode: "insensitive" } },
            { championName: { contains: query, mode: "insensitive" } },
            {
              player: {
                nameHistory: {
                  some: {
                    OR: [
                      { riotIdName: { contains: query, mode: "insensitive" } },
                      { riotIdTagLine: { contains: query, mode: "insensitive" } },
                    ],
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
}

// 公開の「通報一覧」用。ユーザー一覧(findReportedPlayers)がプレイヤー単位の集計なのに対し、
// こちらは個々の通報をそのまま新着順(または古い順)に並べる。非表示にされた通報は対象外。
export async function findPublicReports({
  page,
  pageSize,
  category,
  verdict,
  query,
  sort = "newest",
}: {
  page: number;
  pageSize: number;
  category?: ReportCategory;
  verdict?: ReportedPlayersVerdictFilter;
  query?: string;
  sort?: PublicReportSort;
}) {
  const where = buildFilter({ category, verdict, query });

  const [reports, totalCount] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        player: {
          select: {
            puuid: true,
            nameHistory: { where: { isCurrent: true }, take: 1 },
          },
        },
        moderatorReviews: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.report.count({ where }),
  ]);

  return { reports, totalCount };
}

// 公開の一覧ページ(/reports)はアクセスが集中しうるため、他の公開一覧
// (findReportedPlayersCached等)と同じ方針で絞り込み条件ごとに短時間キャッシュする。
const PUBLIC_REPORTS_CACHE_TTL_MS = 30 * 1000;
export const findPublicReportsCached = memoizeWithTtlByKey(
  findPublicReports,
  PUBLIC_REPORTS_CACHE_TTL_MS,
  (params) =>
    [
      params.page,
      params.pageSize,
      params.category ?? "",
      params.verdict ?? "",
      params.query ?? "",
      params.sort ?? "",
    ].join(":"),
);
