import { prisma } from "@/lib/prisma";
import { ReportCategory, Prisma } from "@/generated/prisma";

export type HiddenFilter = "all" | "hidden" | "visible";
export type ReviewedFilter = "all" | "reviewed" | "unreviewed";

export interface ReportAdminFilters {
  category?: ReportCategory;
  hidden: HiddenFilter;
  reviewed: ReviewedFilter;
  query?: string;
}

// 管理者向けの全通報一覧。非表示にされたものも含めて全件が対象。
// カテゴリ/非表示状態/評価状態での絞り込みと、ゲームID・試合IDのキーワード検索に対応する。
export async function findAllReportsForAdmin({
  page,
  pageSize,
  filters,
}: {
  page: number;
  pageSize: number;
  filters: ReportAdminFilters;
}) {
  const where: Prisma.ReportWhereInput = {};

  if (filters.category) {
    where.category = filters.category;
  }
  if (filters.hidden === "hidden") {
    where.hiddenAt = { not: null };
  } else if (filters.hidden === "visible") {
    where.hiddenAt = null;
  }
  if (filters.reviewed === "reviewed") {
    where.moderatorReviews = { some: {} };
  } else if (filters.reviewed === "unreviewed") {
    where.moderatorReviews = { none: {} };
  }
  if (filters.query) {
    where.OR = [
      { matchId: { contains: filters.query, mode: "insensitive" } },
      { championName: { contains: filters.query, mode: "insensitive" } },
      {
        player: {
          nameHistory: {
            some: {
              OR: [
                { riotIdName: { contains: filters.query, mode: "insensitive" } },
                { riotIdTagLine: { contains: filters.query, mode: "insensitive" } },
              ],
            },
          },
        },
      },
    ];
  }

  const [reports, totalCount] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        player: {
          select: {
            puuid: true,
            nameHistory: { where: { isCurrent: true }, take: 1 },
          },
        },
        moderatorReviews: { select: { id: true }, take: 1 },
      },
    }),
    prisma.report.count({ where }),
  ]);

  return { reports, totalCount };
}
