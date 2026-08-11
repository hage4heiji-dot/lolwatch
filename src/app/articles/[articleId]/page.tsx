import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { DEVICE_ID_COOKIE } from "@/lib/deviceId";
import { ArticleBody } from "@/app/article-body";
import { ArticleVoteBar } from "./article-vote-bar";
import { CommentSection } from "./comment-section";

export const dynamic = "force-dynamic";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
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
  const scoreCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const vote of article.votes) {
    scoreCounts[vote.score] = (scoreCounts[vote.score] ?? 0) + 1;
  }

  return (
    <div>
      <h1>{article.title}</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
        {formatDateTime(article.publishedAt!)} ・ {article.moderator.displayName}
      </p>

      <div style={{ marginBottom: "2rem" }}>
        <ArticleBody body={article.body} />
      </div>

      <ArticleVoteBar
        articleId={article.id}
        initialScoreCounts={scoreCounts}
        initialMyVote={myVote as 1 | 2 | 3 | 4 | 5 | null}
      />

      <CommentSection
        articleId={article.id}
        initialComments={article.comments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          createdAtLabel: formatDateTime(comment.createdAt),
        }))}
      />
    </div>
  );
}
