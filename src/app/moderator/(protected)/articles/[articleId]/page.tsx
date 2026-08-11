import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArticleEditForm } from "./article-edit-form";
import { PublishControl } from "./publish-control";
import { HideCommentControl } from "./hide-comment-control";

export const dynamic = "force-dynamic";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = await params;

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      comments: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { reports: true } } },
      },
    },
  });
  if (!article) {
    notFound();
  }

  return (
    <div>
      <h1>記事を編集</h1>

      <section className="section">
        <PublishControl
          articleId={article.id}
          publishedAt={article.publishedAt?.toISOString() ?? null}
        />
      </section>

      <section className="section">
        <ArticleEditForm
          articleId={article.id}
          title={article.title}
          body={article.body}
          tags={article.tags}
        />
      </section>

      <section className="section">
        <h2>コメント一覧({article.comments.length}件)</h2>
        {article.comments.length === 0 ? (
          <p className="muted" style={{ marginTop: "0.5rem" }}>まだコメントはありません。</p>
        ) : (
          <div>
            {article.comments.map((comment) => (
              <div
                key={comment.id}
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: "0.75rem",
                  marginTop: "0.75rem",
                }}
              >
                <p style={{ whiteSpace: "pre-wrap" }}>{comment.body}</p>
                <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.85rem" }}>
                  {formatDateTime(comment.createdAt)}
                  {comment._count.reports > 0 ? ` ・ 通報${comment._count.reports}件` : ""}
                </p>
                <HideCommentControl
                  commentId={comment.id}
                  articleId={article.id}
                  hiddenAt={comment.hiddenAt?.toISOString() ?? null}
                  hiddenReason={comment.hiddenReason}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
