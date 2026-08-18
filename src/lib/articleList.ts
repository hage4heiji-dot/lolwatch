import { prisma } from "@/lib/prisma";
import { memoizeWithTtlByKey } from "@/lib/ttlCache";
import type { ArticleKind, Prisma } from "@/generated/prisma";

export type PublicArticleSort =
  | "incidentDate_desc"
  | "incidentDate_asc"
  | "severity_desc"
  | "severity_asc";

// severity(炎上度合い)によるソート用。kind=JUDGMENTの記事はseverityを持たない
// (常にnull)ので末尾に固定する(severityの代わりになる指標が無いため)。
function severitySortToOrderBy(
  sort: "severity_desc" | "severity_asc",
): Prisma.ArticleOrderByWithRelationInput[] {
  // Postgres enumはCREATE TYPEで宣言した順(LOW→MEDIUM→HIGH→CRITICAL)でソートされるため、
  // 追加のマッピングなしでそのまま強度順になる。
  return sort === "severity_desc"
    ? [{ severity: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }]
    : [{ severity: { sort: "asc", nulls: "last" } }, { publishedAt: "desc" }];
}

const PUBLIC_ARTICLE_LIST_INCLUDE = {
  moderator: { select: { displayName: true } },
  _count: { select: { comments: { where: { hiddenAt: null } } } },
  votes: { select: { score: true } },
} satisfies Prisma.ArticleInclude;

// 公開の「炎上案件記事」一覧用。通報一覧(findPublicReports)と同じ方針で、
// 非公開(下書き)の記事は対象外にする。tagで絞り込むと、そのタグを含む記事のみ返す。
// queryはタイトル・本文の部分一致(フリーワード検索)。
export async function findPublicArticles({
  page,
  pageSize,
  tag,
  query,
  kind,
  sort = "incidentDate_desc",
}: {
  page: number;
  pageSize: number;
  tag?: string;
  query?: string;
  kind?: ArticleKind;
  sort?: PublicArticleSort;
}) {
  const where: Prisma.ArticleWhereInput = {
    publishedAt: { not: null },
    ...(tag ? { tags: { has: tag } } : {}),
    ...(kind ? { kind } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { body: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  if (sort === "incidentDate_desc" || sort === "incidentDate_asc") {
    // kind=JUDGMENTの記事はincidentDateを持たない(常にnull)。Prismaの宣言的
    // orderByではCOALESCE(incidentDate, publishedAt)のような代替キーが組めず、
    // nullをfirst/lastどちらに固定しても全JUDGMENT記事が一箇所に固まって
    // しまう(公開日が新しくても一番下に埋もれる)。この並び順だけは
    // JS側でincidentDate ?? publishedAtを実効的な日付として計算しソートする。
    // 記事数が数百件規模までのサイト前提の割り切った実装(DB側でのページング
    // ではなく全件取得後にJSでページングする)。
    const all = await prisma.article.findMany({ where, include: PUBLIC_ARTICLE_LIST_INCLUDE });

    const effectiveTime = (a: (typeof all)[number]) => (a.incidentDate ?? a.publishedAt)!.getTime();
    all.sort((a, b) =>
      sort === "incidentDate_asc"
        ? effectiveTime(a) - effectiveTime(b)
        : effectiveTime(b) - effectiveTime(a),
    );

    const totalCount = all.length;
    const start = (page - 1) * pageSize;
    return { articles: all.slice(start, start + pageSize), totalCount };
  }

  const [articles, totalCount] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: severitySortToOrderBy(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: PUBLIC_ARTICLE_LIST_INCLUDE,
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
  (params) =>
    `${params.page}:${params.tag ?? ""}:${params.query ?? ""}:${params.kind ?? ""}:${params.sort ?? ""}`,
);

export interface ArticleRankingItem {
  id: string;
  title: string;
  kind: ArticleKind;
  metric: number;
}

// /articles右サイドバーの「人気記事」ランキング用。GA4実測PV(pageViews)の降順。
async function findPopularArticles(limit: number): Promise<ArticleRankingItem[]> {
  const articles = await prisma.article.findMany({
    where: { publishedAt: { not: null } },
    orderBy: [{ pageViews: "desc" }, { publishedAt: "desc" }],
    take: limit,
    select: { id: true, title: true, kind: true, pageViews: true },
  });
  return articles.map((a) => ({ id: a.id, title: a.title, kind: a.kind, metric: a.pageViews }));
}

const ARTICLE_RANKING_CACHE_TTL_MS = 60 * 1000;
export const findPopularArticlesCached = memoizeWithTtlByKey(
  findPopularArticles,
  ARTICLE_RANKING_CACHE_TTL_MS,
  (limit) => String(limit),
);

// /articles右サイドバーの「コメントが多い記事」ランキング用。非表示コメントを除いた
// 件数で表示したいが、Prismaの_countによるorderByはリレーションのwhere絞り込みを
// 適用できないため、並び順は全コメント数(hidden含む)で行う。非表示は稀なため
// 実用上ずれは無視できる。
async function findMostCommentedArticles(limit: number): Promise<ArticleRankingItem[]> {
  const articles = await prisma.article.findMany({
    where: { publishedAt: { not: null } },
    orderBy: [{ comments: { _count: "desc" } }, { publishedAt: "desc" }],
    take: limit,
    select: { id: true, title: true, kind: true, _count: { select: { comments: true } } },
  });
  return articles
    .filter((a) => a._count.comments > 0)
    .map((a) => ({ id: a.id, title: a.title, kind: a.kind, metric: a._count.comments }));
}

export const findMostCommentedArticlesCached = memoizeWithTtlByKey(
  findMostCommentedArticles,
  ARTICLE_RANKING_CACHE_TTL_MS,
  (limit) => String(limit),
);

export interface RecentCommentItem {
  commentId: string;
  articleId: string;
  articleTitle: string;
  articleKind: ArticleKind;
  body: string;
  createdAt: Date;
}

// /articles右サイドバーの「最近のコメント」用。人気記事/コメント数ランキングとは
// 別軸で、サイト全体の直近の動き(鮮度)を見せて回遊を誘う。非表示コメント・
// 非公開記事のコメントは除く。
async function findRecentComments(limit: number): Promise<RecentCommentItem[]> {
  const comments = await prisma.articleComment.findMany({
    where: { hiddenAt: null, article: { publishedAt: { not: null } } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      body: true,
      createdAt: true,
      article: { select: { id: true, title: true, kind: true } },
    },
  });
  return comments.map((c) => ({
    commentId: c.id,
    articleId: c.article.id,
    articleTitle: c.article.title,
    articleKind: c.article.kind,
    body: c.body,
    createdAt: c.createdAt,
  }));
}

// ランキング(1分キャッシュ)より鮮度を重視し、短めのTTLにする。
const RECENT_COMMENTS_CACHE_TTL_MS = 20 * 1000;
export const findRecentCommentsCached = memoizeWithTtlByKey(
  findRecentComments,
  RECENT_COMMENTS_CACHE_TTL_MS,
  (limit) => String(limit),
);

export interface RelatedArticleItem {
  id: string;
  title: string;
  kind: ArticleKind;
  tags: string[];
}

// 記事詳細ページの「関連記事」用。同じタグを持つ記事をタグ一致数の多い順に、
// 同数ならPVが高い順に返す。一致するタグが無い/足りない場合は、サイトに
// とどまってもらう導線を優先し、人気記事で埋め合わせる。
async function findRelatedArticles({
  articleId,
  tags,
  limit,
}: {
  articleId: string;
  tags: string[];
  limit: number;
}): Promise<RelatedArticleItem[]> {
  const candidates =
    tags.length === 0
      ? []
      : await prisma.article.findMany({
          where: { publishedAt: { not: null }, id: { not: articleId }, tags: { hasSome: tags } },
          orderBy: [{ pageViews: "desc" }, { publishedAt: "desc" }],
          take: limit * 4,
          select: { id: true, title: true, kind: true, tags: true, pageViews: true },
        });

  const scored = candidates
    .map((a) => ({ ...a, overlap: a.tags.filter((t) => tags.includes(t)).length }))
    .sort((a, b) => b.overlap - a.overlap || b.pageViews - a.pageViews)
    .slice(0, limit);

  if (scored.length >= limit) {
    return scored.map((a) => ({ id: a.id, title: a.title, kind: a.kind, tags: a.tags }));
  }

  const excludeIds = [articleId, ...scored.map((a) => a.id)];
  const fallback = await prisma.article.findMany({
    where: { publishedAt: { not: null }, id: { notIn: excludeIds } },
    orderBy: [{ pageViews: "desc" }, { publishedAt: "desc" }],
    take: limit - scored.length,
    select: { id: true, title: true, kind: true, tags: true },
  });

  return [
    ...scored.map((a) => ({ id: a.id, title: a.title, kind: a.kind, tags: a.tags })),
    ...fallback,
  ];
}

const RELATED_ARTICLES_CACHE_TTL_MS = 60 * 1000;
export const findRelatedArticlesCached = memoizeWithTtlByKey(
  findRelatedArticles,
  RELATED_ARTICLES_CACHE_TTL_MS,
  (params) => `${params.articleId}:${params.tags.join(",")}:${params.limit}`,
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
