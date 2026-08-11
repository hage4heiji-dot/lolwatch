import Link from "next/link";
import type { Metadata } from "next";
import { findPublicArticlesCached, extractFirstImageUrl } from "@/lib/articleList";
import { SEVERITY_LABELS, SEVERITY_ICONS } from "@/lib/articleSeverity";

const PAGE_SIZE = 20;

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

function buildHref(page: number, tag?: string): string {
  const sp = new URLSearchParams();
  if (tag) sp.set("tag", tag);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/articles?${qs}` : "/articles";
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tag?: string }>;
}) {
  const { page: pageParam, tag: tagParam } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const tag = tagParam?.trim() || undefined;

  const { articles, totalCount } = await findPublicArticlesCached({
    page,
    pageSize: PAGE_SIZE,
    tag,
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div>
      <h1>炎上案件</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
        LoLで話題になったトロール系の炎上案件をまとめた記事です。各記事にコメントできます。
      </p>

      {tag && (
        <p className="muted" style={{ marginBottom: "1rem" }}>
          「{tag}」で絞り込み中 ・ <Link href="/articles">解除</Link>
        </p>
      )}

      {articles.length === 0 ? (
        <div className="empty-state">
          <p>まだ記事はありません。</p>
        </div>
      ) : (
        <div>
          {articles.map((article) => {
            const thumbUrl = extractFirstImageUrl(article.body);
            return (
              <Link key={article.id} href={`/articles/${article.id}`} className="card">
                <div className="article-card-inner">
                  {thumbUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbUrl} alt="" className="article-card-thumb" />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="badge" title={SEVERITY_LABELS[article.severity]}>
                      {SEVERITY_ICONS[article.severity]} {SEVERITY_LABELS[article.severity]}
                    </span>
                    <h2 style={{ fontSize: "1.05rem", marginTop: "0.4rem" }}>{article.title}</h2>
                    <p className="muted" style={{ marginTop: "0.4rem" }}>{excerpt(article.body)}</p>
                    <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                      {formatDate(article.incidentDate)}に発生 ・ コメント
                      {article._count.comments}件
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
            <Link className="btn btn-secondary" href={buildHref(page - 1, tag)}>
              前へ
            </Link>
          ) : (
            <span />
          )}
          <span className="muted">
            {page} / {totalPages} ページ
          </span>
          {page < totalPages ? (
            <Link className="btn btn-secondary" href={buildHref(page + 1, tag)}>
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
