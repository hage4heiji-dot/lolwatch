import Link from "next/link";
import type { Metadata } from "next";
import { findPublicArticlesCached } from "@/lib/articleList";

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

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);

  const { articles, totalCount } = await findPublicArticlesCached({ page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div>
      <h1>炎上案件</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
        LoLで話題になったトロール系の炎上案件をまとめた記事です。各記事にコメントできます。
      </p>

      {articles.length === 0 ? (
        <div className="empty-state">
          <p>まだ記事はありません。</p>
        </div>
      ) : (
        <div>
          {articles.map((article) => (
            <Link key={article.id} href={`/articles/${article.id}`} className="card">
              <h2 style={{ fontSize: "1.05rem" }}>{article.title}</h2>
              <p className="muted" style={{ marginTop: "0.4rem" }}>{excerpt(article.body)}</p>
              <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                {article.publishedAt ? formatDate(article.publishedAt) : ""} ・ コメント
                {article._count.comments}件
              </p>
            </Link>
          ))}
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
            <Link className="btn btn-secondary" href={`/articles?page=${page - 1}`}>
              前へ
            </Link>
          ) : (
            <span />
          )}
          <span className="muted">
            {page} / {totalPages} ページ
          </span>
          {page < totalPages ? (
            <Link className="btn btn-secondary" href={`/articles?page=${page + 1}`}>
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
