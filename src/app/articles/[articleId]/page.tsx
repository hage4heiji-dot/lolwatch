import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { DEVICE_ID_COOKIE } from "@/lib/deviceId";
import { ArticleBody } from "@/app/article-body";
import { ArticleVoteBar } from "./article-vote-bar";
import { CommentSection } from "./comment-section";
import { SEVERITY_LABELS, SEVERITY_ICONS } from "@/lib/articleSeverity";
import { ARTICLE_KIND_LABELS, ARTICLE_KIND_ICONS } from "@/lib/articleKind";
import { computeScoreCounts, findRelatedArticlesCached } from "@/lib/articleList";
import { ArticleRankingSidebar } from "../article-ranking-sidebar";

export const dynamic = "force-dynamic";

const SITE_URL = "https://lol-watch.com";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

async function getArticle(articleId: string) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      moderator: { select: { displayName: true } },
      comments: {
        where: { hiddenAt: null },
        orderBy: { createdAt: "asc" },
      },
      votes: true,
    },
  });
  if (!article || !article.publishedAt) return null;
  return article;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ articleId: string }>;
}): Promise<Metadata> {
  const { articleId } = await params;
  const article = await getArticle(articleId);
  if (!article) return {};
  return {
    title: article.title,
    description: article.body.slice(0, 120),
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = await params;
  const article = await getArticle(articleId);
  if (!article) {
    notFound();
  }

  const cookieStore = await cookies();
  const deviceId = cookieStore.get(DEVICE_ID_COOKIE)?.value ?? null;
  const myVote = deviceId
    ? (article.votes.find((v) => v.deviceId === deviceId)?.score ?? null)
    : null;
  const scoreCounts = computeScoreCounts(article.votes);
  const relatedArticles = await findRelatedArticlesCached({
    articleId: article.id,
    tags: article.tags,
    limit: 4,
  });

  return (
    <div className="articles-layout">
    <div>
      <Link href="/articles" className="muted" style={{ fontSize: "0.85rem" }}>
        ← 炎上案件一覧に戻る
      </Link>
      <h1 style={{ marginTop: "0.75rem" }}>{article.title}</h1>
      <p className="muted" style={{ marginTop: "0.75rem" }}>
        <span className="badge" title={ARTICLE_KIND_LABELS[article.kind]}>
          {ARTICLE_KIND_ICONS[article.kind]} {ARTICLE_KIND_LABELS[article.kind]}
        </span>{" "}
        {article.severity && (
          <span className="badge" title={SEVERITY_LABELS[article.severity]}>
            {SEVERITY_ICONS[article.severity]} {SEVERITY_LABELS[article.severity]}
          </span>
        )}{" "}
        {article.incidentDate && `${formatDate(article.incidentDate)}に発生`}
      </p>
      <p
        className="muted"
        style={{ marginTop: "0.35rem", marginBottom: article.tags.length > 0 ? "0.5rem" : "1.5rem" }}
      >
        公開: {formatDateTime(article.publishedAt!)} ・ {article.moderator.displayName}
      </p>

      {article.tags.length > 0 && (
        <div className="article-card-tags" style={{ marginBottom: "1.5rem" }}>
          {article.tags.map((t) => (
            <Link key={t} href={`/articles?tag=${encodeURIComponent(t)}`} className="badge">
              {t}
            </Link>
          ))}
        </div>
      )}

      <div style={{ marginBottom: "2rem" }}>
        <ArticleBody body={article.body} />
      </div>

      <ArticleVoteBar
        articleId={article.id}
        kind={article.kind}
        pageUrl={`${SITE_URL}/articles/${article.id}`}
        initialScoreCounts={scoreCounts}
        initialMyVote={myVote as 1 | 2 | 3 | 4 | 5 | null}
      />

      {relatedArticles.length > 0 && (
        <div className="section">
          <h2>関連記事</h2>
          <div className="related-articles-grid">
            {relatedArticles.map((related) => (
              <Link key={related.id} href={`/articles/${related.id}`} className="card">
                <span className="badge" title={ARTICLE_KIND_LABELS[related.kind]}>
                  {ARTICLE_KIND_ICONS[related.kind]} {ARTICLE_KIND_LABELS[related.kind]}
                </span>
                <p style={{ marginTop: "0.4rem", fontSize: "0.9rem", lineHeight: 1.4 }}>
                  {related.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <CommentSection
        articleId={article.id}
        initialComments={article.comments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          createdAtLabel: formatDateTime(comment.createdAt),
          voteScoreAtPost: comment.voteScoreAtPost as 1 | 2 | 3 | 4 | 5 | null,
        }))}
      />
    </div>

    <ArticleRankingSidebar excludeArticleId={article.id} />
    </div>
  );
}
