import { prisma } from "@/lib/prisma";
import { memoizeWithTtlByKey } from "@/lib/ttlCache";

// 公開の「炎上案件記事」一覧用。通報一覧(findPublicReports)と同じ方針で、
// 非公開(下書き)の記事は対象外にする。tagで絞り込むと、そのタグを含む記事のみ返す。
export async function findPublicArticles({
  page,
  pageSize,
  tag,
}: {
  page: number;
  pageSize: number;
  tag?: string;
}) {
  const where = {
    publishedAt: { not: null },
    ...(tag ? { tags: { has: tag } } : {}),
  };

  const [articles, totalCount] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { incidentDate: "desc" },
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
// (findPublicReportsCached等)と同じ方針で絞り込み条件ごとに短時間キャッシュする。
const PUBLIC_ARTICLES_CACHE_TTL_MS = 30 * 1000;
export const findPublicArticlesCached = memoizeWithTtlByKey(
  findPublicArticles,
  PUBLIC_ARTICLES_CACHE_TTL_MS,
  (params) => `${params.page}:${params.tag ?? ""}`,
);

// 一覧のサムネイル用。専用のアイキャッチ欄は持たず、本文中(Markdown)に最初に
// 出てくる画像をそのまま使う。
const FIRST_IMAGE_PATTERN = /!\[[^\]]*\]\(([^)\s]+)/;

export function extractFirstImageUrl(body: string): string | null {
  return FIRST_IMAGE_PATTERN.exec(body)?.[1] ?? null;
}
