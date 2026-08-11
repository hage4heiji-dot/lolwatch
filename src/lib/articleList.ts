import { prisma } from "@/lib/prisma";
import { memoizeWithTtlByKey } from "@/lib/ttlCache";
import type { Prisma } from "@/generated/prisma";

export type PublicArticleSort =
  | "incidentDate_desc"
  | "incidentDate_asc"
  | "severity_desc"
  | "severity_asc";

function sortToOrderBy(sort: PublicArticleSort): Prisma.ArticleOrderByWithRelationInput {
  switch (sort) {
    case "incidentDate_asc":
      return { incidentDate: "asc" };
    case "severity_desc":
      // Postgres enumはCREATE TYPEで宣言した順(LOW→MEDIUM→HIGH→CRITICAL)でソートされるため、
      // 追加のマッピングなしでそのまま強度順になる。
      return { severity: "desc" };
    case "severity_asc":
      return { severity: "asc" };
    case "incidentDate_desc":
    default:
      return { incidentDate: "desc" };
  }
}

// 公開の「炎上案件記事」一覧用。通報一覧(findPublicReports)と同じ方針で、
// 非公開(下書き)の記事は対象外にする。tagで絞り込むと、そのタグを含む記事のみ返す。
// queryはタイトル・本文の部分一致(フリーワード検索)。
export async function findPublicArticles({
  page,
  pageSize,
  tag,
  query,
  sort = "incidentDate_desc",
}: {
  page: number;
  pageSize: number;
  tag?: string;
  query?: string;
  sort?: PublicArticleSort;
}) {
  const where: Prisma.ArticleWhereInput = {
    publishedAt: { not: null },
    ...(tag ? { tags: { has: tag } } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { body: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [articles, totalCount] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: sortToOrderBy(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        moderator: { select: { displayName: true } },
        _count: { select: { comments: { where: { hiddenAt: null } } } },
        votes: { select: { score: true } },
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
  (params) => `${params.page}:${params.tag ?? ""}:${params.query ?? ""}:${params.sort ?? ""}`,
);

// タグ絞り込みのプルダウン用。公開記事に実際に使われているタグだけを新しい順ではなく
// 五十音/アルファベット順で返す(タグは自由入力のため固定enumを持たない)。
async function findPublicArticleTags(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ tag: string }[]>`
    SELECT DISTINCT unnest(tags) AS tag
    FROM "Article"
    WHERE "publishedAt" IS NOT NULL
    ORDER BY tag
  `;
  return rows.map((row) => row.tag);
}

const PUBLIC_ARTICLE_TAGS_CACHE_TTL_MS = 60 * 1000;
export const findPublicArticleTagsCached = memoizeWithTtlByKey(
  findPublicArticleTags,
  PUBLIC_ARTICLE_TAGS_CACHE_TTL_MS,
  () => "all",
);

// 一覧のサムネイル用。専用のアイキャッチ欄は持たず、本文中(Markdown)に最初に
// 出てくる画像をそのまま使う。
const FIRST_IMAGE_PATTERN = /!\[[^\]]*\]\(([^)\s]+)/;

export function extractFirstImageUrl(body: string): string | null {
  return FIRST_IMAGE_PATTERN.exec(body)?.[1] ?? null;
}

// ArticleVote(1〜5段階)の集計。一覧カードの簡易表示・詳細ページの投票バー両方で使う。
export function computeScoreCounts(votes: { score: number }[]): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const vote of votes) {
    counts[vote.score] = (counts[vote.score] ?? 0) + 1;
  }
  return counts;
}
