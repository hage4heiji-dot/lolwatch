import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SEVERITY_LABELS, SEVERITY_ICONS } from "@/lib/articleSeverity";
import { ARTICLE_KIND_LABELS, ARTICLE_KIND_ICONS, ARTICLE_KIND_ORDER } from "@/lib/articleKind";
import type { ArticleKind, Prisma } from "@/generated/prisma";

export const dynamic = "force-dynamic";

type StatusFilter = "all" | "draft" | "published" | "archived";
type KindFilter = "all" | ArticleKind;

function toStatusFilter(value: string | undefined): StatusFilter {
  return value === "draft" || value === "published" || value === "archived" ? value : "all";
}

function toKindFilter(value: string | undefined): KindFilter {
  return value === "INCIDENT" || value === "JUDGMENT" ? value : "all";
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

function whereForKind(kind: KindFilter): Prisma.ArticleWhereInput {
  return kind === "all" ? {} : { kind };
}

function buildHref(params: { status: StatusFilter; kind: KindFilter }): string {
  const sp = new URLSearchParams();
  if (params.status !== "all") sp.set("status", params.status);
  if (params.kind !== "all") sp.set("kind", params.kind);
  const qs = sp.toString();
  return qs ? `/moderator/articles?${qs}` : "/moderator/articles";
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
  searchParams: Promise<{ status?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const status = toStatusFilter(params.status);
  const kind = toKindFilter(params.kind);

  const [articles, draftCount, publishedCount, archivedCount, incidentCount, judgmentCount] =
    await Promise.all([
      prisma.article.findMany({
        where: { ...whereForStatus(status), ...whereForKind(kind) },
        orderBy: [{ incidentDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        include: {
          moderator: { select: { displayName: true } },
          _count: { select: { comments: true } },
        },
      }),
      prisma.article.count({ where: { ...whereForStatus("draft"), ...whereForKind(kind) } }),
      prisma.article.count({ where: { ...whereForStatus("published"), ...whereForKind(kind) } }),
      prisma.article.count({ where: { ...whereForStatus("archived"), ...whereForKind(kind) } }),
      prisma.article.count({ where: { ...whereForStatus(status), ...whereForKind("INCIDENT") } }),
      prisma.article.count({ where: { ...whereForStatus(status), ...whereForKind("JUDGMENT") } }),
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
          href={buildHref({ status: "all", kind })}
        >
          すべて({draftCount + publishedCount + archivedCount})
        </Link>
        <Link
          className={`btn ${status === "draft" ? "" : "btn-secondary"}`}
          href={buildHref({ status: "draft", kind })}
        >
          ⏳ 下書き(要確認)({draftCount})
        </Link>
        <Link
          className={`btn ${status === "published" ? "" : "btn-secondary"}`}
          href={buildHref({ status: "published", kind })}
        >
          🌐 公開中({publishedCount})
        </Link>
        <Link
          className={`btn ${status === "archived" ? "" : "btn-secondary"}`}
          href={buildHref({ status: "archived", kind })}
        >
          🗄️ 非公開({archivedCount})
        </Link>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
        <Link
          className={`btn ${kind === "all" ? "" : "btn-secondary"}`}
          href={buildHref({ status, kind: "all" })}
        >
          すべての種類({incidentCount + judgmentCount})
        </Link>
        {ARTICLE_KIND_ORDER.map((k) => (
          <Link
            key={k}
            className={`btn ${kind === k ? "" : "btn-secondary"}`}
            href={buildHref({ status, kind: k })}
          >
            {ARTICLE_KIND_ICONS[k]} {ARTICLE_KIND_LABELS[k]}(
            {k === "INCIDENT" ? incidentCount : judgmentCount})
          </Link>
        ))}
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
                <th>種類</th>
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
                    <Link
                      href={`/moderator/articles/${article.id}`}
                      title={article.title}
                      style={{
                        display: "inline-block",
                        maxWidth: "320px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        verticalAlign: "middle",
                      }}
                    >
                      {article.title}
                    </Link>
                  </td>
                  <td title={ARTICLE_KIND_LABELS[article.kind]}>
                    {ARTICLE_KIND_ICONS[article.kind]} {ARTICLE_KIND_LABELS[article.kind]}
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
                  <td title={article.severity ? SEVERITY_LABELS[article.severity] : ""}>
                    {article.severity ? SEVERITY_ICONS[article.severity] : "-"}
                  </td>
                  <td className="muted">{article.moderator.displayName}</td>
                  <td>{article._count.comments}</td>
                  <td className="muted">{article.incidentDate ? formatDate(article.incidentDate) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
