import Link from "next/link";
import type { Metadata } from "next";
import {
  findPublicArticlesCached,
  findPublicArticleTagsCached,
  extractFirstImageUrl,
  computeScoreCounts,
  type PublicArticleSort,
} from "@/lib/articleList";
import { SEVERITY_LABELS, SEVERITY_ICONS } from "@/lib/articleSeverity";
import { ARTICLE_KIND_LABELS, ARTICLE_KIND_ICONS, ARTICLE_KIND_ORDER } from "@/lib/articleKind";
import type { ArticleKind } from "@/generated/prisma";
import { VoteRateBar } from "./vote-rate-bar";

const PAGE_SIZE = 20;

const SORT_LABELS: Record<PublicArticleSort, string> = {
  incidentDate_desc: "炎上日が新しい順",
  incidentDate_asc: "炎上日が古い順",
  severity_desc: "炎上度合いが高い順",
  severity_asc: "炎上度合いが低い順",
};
const SORT_VALUES = Object.keys(SORT_LABELS) as PublicArticleSort[];
const DEFAULT_SORT: PublicArticleSort = "incidentDate_desc";

// DB記事件数を毎回集計するため、ビルド時の静的プリレンダー対象から外す。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "炎上案件",
  description: "LoLで話題になったトロール系の炎上案件をまとめた記事の一覧です。各記事にコメントできます。",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function excerpt(body: string, maxLength = 120): string {
  const trimmed = body.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

function isSort(value: string): value is PublicArticleSort {
  return (SORT_VALUES as string[]).includes(value);
}

interface FilterParams {
  q?: string;
  tag?: string;
  kind?: ArticleKind;
  sort: PublicArticleSort;
}

function isKind(value: string): value is ArticleKind {
  return (ARTICLE_KIND_ORDER as string[]).includes(value);
}

function buildHref(params: FilterParams & { page?: number }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.tag) sp.set("tag", params.tag);
  if (params.kind) sp.set("kind", params.kind);
  if (params.sort !== DEFAULT_SORT) sp.set("sort", params.sort);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/articles?${qs}` : "/articles";
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tag?: string; q?: string; kind?: string; sort?: string }>;
}) {
  const { page: pageParam, tag: tagParam, q: qParam, kind: kindParam, sort: sortParam } =
    await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const tag = tagParam?.trim() || undefined;
  const query = qParam?.trim() || undefined;
  const kind = kindParam && isKind(kindParam) ? kindParam : undefined;
  const sort = sortParam && isSort(sortParam) ? sortParam : DEFAULT_SORT;
  const filters: FilterParams = { q: query, tag, kind, sort };

  const [{ articles, totalCount }, availableTags] = await Promise.all([
    findPublicArticlesCached({ page, pageSize: PAGE_SIZE, tag, query, kind, sort }),
    findPublicArticleTagsCached(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = Boolean(query || tag || kind || sort !== DEFAULT_SORT);

  return (
    <div>
      <h1>炎上案件</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
        LoLで話題になったトロール系の炎上案件をまとめた記事です。各記事にコメントできます。
      </p>

      <form style={{ marginBottom: "1.5rem" }}>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="q">フリーワード検索</label>
            <input type="text" id="q" name="q" defaultValue={query ?? ""} placeholder="例: AI, ブースティング" />
          </div>
          <div className="form-field">
            <label htmlFor="tag">タグ</label>
            <select id="tag" name="tag" defaultValue={tag ?? ""}>
              <option value="">すべて</option>
              {availableTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="kind">種類</label>
            <select id="kind" name="kind" defaultValue={kind ?? ""}>
              <option value="">すべて</option>
              {ARTICLE_KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {ARTICLE_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="sort">並び順</label>
            <select id="sort" name="sort" defaultValue={sort}>
              {SORT_VALUES.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn" type="submit">
            検索
          </button>
          {hasFilters && (
            <Link className="btn btn-secondary" href="/articles">
              条件をクリア
            </Link>
          )}
        </div>
      </form>

      {articles.length === 0 ? (
        <div className="empty-state">
          <p>{hasFilters ? "条件に一致する記事が見つかりませんでした。" : "まだ記事はありません。"}</p>
        </div>
      ) : (
        <div>
          {articles.map((article) => {
            const thumbUrl = extractFirstImageUrl(article.body);
            const scoreCounts = computeScoreCounts(article.votes);
            const voteTotal = article.votes.length;
            return (
              <Link key={article.id} href={`/articles/${article.id}`} className="card">
                <div className="article-card-inner">
                  {thumbUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbUrl} alt="" className="article-card-thumb" />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="badge" title={ARTICLE_KIND_LABELS[article.kind]}>
                      {ARTICLE_KIND_ICONS[article.kind]} {ARTICLE_KIND_LABELS[article.kind]}
                    </span>{" "}
                    {article.severity && (
                      <span className="badge" title={SEVERITY_LABELS[article.severity]}>
                        {SEVERITY_ICONS[article.severity]} {SEVERITY_LABELS[article.severity]}
                      </span>
                    )}
                    <h2 style={{ fontSize: "1.05rem", marginTop: "0.4rem" }}>{article.title}</h2>
                    <p className="muted" style={{ marginTop: "0.4rem" }}>{excerpt(article.body)}</p>
                    <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                      {article.incidentDate ? `${formatDate(article.incidentDate)}に発生 ・ ` : ""}
                      コメント{article._count.comments}件
                    </p>
                    {article.tags.length > 0 && (
                      <div className="article-card-tags">
                        {article.tags.map((t) => (
                          <span key={t} className="badge">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: "0.6rem", maxWidth: "320px" }}>
                      <VoteRateBar scoreCounts={scoreCounts} compact />
                      <p className="muted" style={{ marginTop: "0.25rem", fontSize: "0.75rem" }}>
                        {voteTotal > 0 ? `違反/問題なしレート ${voteTotal}票` : "まだ投票はありません"}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "1.5rem",
          }}
        >
          {page > 1 ? (
            <Link className="btn btn-secondary" href={buildHref({ ...filters, page: page - 1 })}>
              前へ
            </Link>
          ) : (
            <span />
          )}
          <span className="muted">
            {page} / {totalPages} ページ
          </span>
          {page < totalPages ? (
            <Link className="btn btn-secondary" href={buildHref({ ...filters, page: page + 1 })}>
              次へ
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
