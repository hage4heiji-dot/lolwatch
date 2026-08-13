import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SEVERITY_LABELS, SEVERITY_ICONS } from "@/lib/articleSeverity";
import type { Prisma } from "@/generated/prisma";

export const dynamic = "force-dynamic";

type StatusFilter = "all" | "draft" | "published" | "archived";

function toStatusFilter(value: string | undefined): StatusFilter {
  return value === "draft" || value === "published" || value === "archived" ? value : "all";
}

function whereForStatus(status: StatusFilter): Prisma.ArticleWhereInput {
  switch (status) {
    case "draft":
      return { publishedAt: null, archivedAt: null };
    case "published":
      return { publishedAt: { not: null } };
    case "archived":
      return { publishedAt: null, archivedAt: { not: null } };
    case "all":
      return {};
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

export default async function ModeratorArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = toStatusFilter(params.status);

  const [articles, draftCount, publishedCount, archivedCount] = await Promise.all([
    prisma.article.findMany({
      where: whereForStatus(status),
      orderBy: { incidentDate: "desc" },
      include: {
        moderator: { select: { displayName: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.article.count({ where: whereForStatus("draft") }),
    prisma.article.count({ where: whereForStatus("published") }),
    prisma.article.count({ where: whereForStatus("archived") }),
  ]);

  return (
    <div>
      <h1>炎上案件記事</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
        トロール系の炎上案件をまとめた記事の管理画面です。作成した記事は公開するまで一般には表示されません。
        「下書き」は人間の確認待ち、「非公開」は重複などの理由で確認不要と判断済みの記事です。
      </p>

      <Link className="btn" href="/moderator/articles/new">
        新規作成
      </Link>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1.5rem" }}>
        <Link
          className={`btn ${status === "all" ? "" : "btn-secondary"}`}
          href="/moderator/articles"
        >
          すべて({draftCount + publishedCount + archivedCount})
        </Link>
        <Link
          className={`btn ${status === "draft" ? "" : "btn-secondary"}`}
          href="/moderator/articles?status=draft"
        >
          ⏳ 下書き(要確認)({draftCount})
        </Link>
        <Link
          className={`btn ${status === "published" ? "" : "btn-secondary"}`}
          href="/moderator/articles?status=published"
        >
          🌐 公開中({publishedCount})
        </Link>
        <Link
          className={`btn ${status === "archived" ? "" : "btn-secondary"}`}
          href="/moderator/articles?status=archived"
        >
          🗄️ 非公開({archivedCount})
        </Link>
      </div>

      {articles.length === 0 ? (
        <div className="empty-state" style={{ marginTop: "1.5rem" }}>
          <p>該当する記事はありません。</p>
        </div>
      ) : (
        <div className="table-scroll" style={{ marginTop: "1.5rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>タイトル</th>
                <th>状態</th>
                <th>炎上度合い</th>
                <th>作成者</th>
                <th>コメント数</th>
                <th>炎上日</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id}>
                  <td>
                    <Link href={`/moderator/articles/${article.id}`}>{article.title}</Link>
                  </td>
                  <td>
                    {article.publishedAt ? (
                      <span className="badge badge-verified">🌐 公開中</span>
                    ) : article.archivedAt ? (
                      <span className="badge">🗄️ 非公開</span>
                    ) : (
                      <span className="badge badge-unverified">⏳ 下書き(要確認)</span>
                    )}
                  </td>
                  <td title={SEVERITY_LABELS[article.severity]}>
                    {SEVERITY_ICONS[article.severity]}
                  </td>
                  <td className="muted">{article.moderator.displayName}</td>
                  <td>{article._count.comments}</td>
                  <td className="muted">{formatDate(article.incidentDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
