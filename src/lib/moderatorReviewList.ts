import { prisma } from "@/lib/prisma";

// モデレーター本人が「自分がレビューした通報一覧」を確認するための一覧取得。
// 通報全体(findAllReportsForAdmin)とは異なり、起点はModeratorReview側になる。
export async function findReviewsByModerator({
  moderatorId,
  page,
  pageSize,
}: {
  moderatorId: string;
  page: number;
  pageSize: number;
}) {
  const where = { moderatorId };

  const [reviews, totalCount] = await Promise.all([
    prisma.moderatorReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        report: {
          include: {
            player: {
              select: {
                puuid: true,
                nameHistory: { where: { isCurrent: true }, take: 1 },
              },
            },
          },
        },
      },
    }),
    prisma.moderatorReview.count({ where }),
  ]);

  return { reviews, totalCount };
}
