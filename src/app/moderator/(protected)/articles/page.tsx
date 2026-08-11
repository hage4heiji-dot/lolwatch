import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SEVERITY_LABELS, SEVERITY_ICONS } from "@/lib/articleSeverity";

export const dynamic = "force-dynamic";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

export default async function ModeratorArticlesPage() {
  const articles = await prisma.article.findMany({
    orderBy: { incidentDate: "desc" },
    include: {
      moderator: { select: { displayName: true } },
      _count: { select: { comments: true } },
    },
  });

  return (
    <div>
      <h1>炎上案件記事</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
        トロール系の炎上案件をまとめた記事の管理画面です。作成した記事は公開するまで一般には表示されません。
      </p>

      <Link className="btn" href="/moderator/articles/new">
        新規作成
      </Link>

      {articles.length === 0 ? (
        <div className="empty-state" style={{ marginTop: "1.5rem" }}>
          <p>まだ記事はありません。</p>
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
                      <span className="badge">公開中</span>
                    ) : (
                      <span className="muted">下書き</span>
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
