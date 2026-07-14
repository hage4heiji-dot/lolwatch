import { prisma } from "@/lib/prisma";
import { ModeratorVerdict } from "@/generated/prisma";

export interface ModeratorStat {
  id: string;
  displayName: string;
  isAdmin: boolean;
  totalReviews: number;
  verdictCounts: Record<ModeratorVerdict, number>;
  lastReviewAt: Date | null;
}

const EMPTY_VERDICT_COUNTS: Record<ModeratorVerdict, number> = {
  VIOLATION_CONFIRMED: 0,
  NO_VIOLATION: 0,
  INSUFFICIENT_EVIDENCE: 0,
};

// モデレーターごとのレビュー件数・判定内訳・最終レビュー日時を集計する。
// 件数の多い順に並べ、管理者ダッシュボードでの活動量把握に使う。
export async function getModeratorStats(): Promise<ModeratorStat[]> {
  const [moderators, verdictGroups, lastReviewGroups] = await Promise.all([
    prisma.moderator.findMany({
      select: { id: true, displayName: true, isAdmin: true },
    }),
    prisma.moderatorReview.groupBy({
      by: ["moderatorId", "verdict"],
      _count: { _all: true },
    }),
    prisma.moderatorReview.groupBy({
      by: ["moderatorId"],
      _max: { createdAt: true },
    }),
  ]);

  const verdictMap = new Map<string, Record<ModeratorVerdict, number>>();
  for (const group of verdictGroups) {
    const counts = verdictMap.get(group.moderatorId) ?? { ...EMPTY_VERDICT_COUNTS };
    counts[group.verdict] = group._count._all;
    verdictMap.set(group.moderatorId, counts);
  }

  const lastReviewMap = new Map<string, Date>();
  for (const group of lastReviewGroups) {
    if (group._max.createdAt) {
      lastReviewMap.set(group.moderatorId, group._max.createdAt);
    }
  }

  return moderators
    .map((moderator) => {
      const verdictCounts = verdictMap.get(moderator.id) ?? { ...EMPTY_VERDICT_COUNTS };
      const totalReviews =
        verdictCounts.VIOLATION_CONFIRMED +
        verdictCounts.NO_VIOLATION +
        verdictCounts.INSUFFICIENT_EVIDENCE;

      return {
        id: moderator.id,
        displayName: moderator.displayName,
        isAdmin: moderator.isAdmin,
        totalReviews,
        verdictCounts,
        lastReviewAt: lastReviewMap.get(moderator.id) ?? null,
      };
    })
    .sort((a, b) => b.totalReviews - a.totalReviews);
}
