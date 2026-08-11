import { prisma } from "@/lib/prisma";
import { memoizeWithTtlByKey } from "@/lib/ttlCache";

// 公開の「炎上案件記事」一覧用。通報一覧(findPublicReports)と同じ方針で、
// 非公開(下書き)の記事は対象外にする。
export async function findPublicArticles({
  page,
  pageSize,
}: {
  page: number;
  pageSize: number;
}) {
  const where = { publishedAt: { not: null } };

  const [articles, totalCount] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        moderator: { select: { displayName: true } },
        _count: { select: { comments: { where: { hiddenAt: null } } } },
      },
    }),
    prisma.article.count({ where }),
  ]);

  return { articles, totalCount };
}

// 公開の一覧ページ(/articles)はアクセスが集中しうるため、他の公開一覧
// (findPublicReportsCached等)と同じ方針でページごとに短時間キャッシュする。
const PUBLIC_ARTICLES_CACHE_TTL_MS = 30 * 1000;
export const findPublicArticlesCached = memoizeWithTtlByKey(
  findPublicArticles,
  PUBLIC_ARTICLES_CACHE_TTL_MS,
  (params) => String(params.page),
);
