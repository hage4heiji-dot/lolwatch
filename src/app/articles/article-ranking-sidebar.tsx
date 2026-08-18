import Link from "next/link";
import {
  findPopularArticlesCached,
  findMostCommentedArticlesCached,
  findRecentCommentsCached,
  type ArticleRankingItem,
  type RecentCommentItem,
} from "@/lib/articleList";
import { ARTICLE_KIND_ICONS } from "@/lib/articleKind";

const RANKING_LIMIT = 5;
const RECENT_COMMENTS_LIMIT = 6;
const COMMENT_EXCERPT_LENGTH = 40;

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function excerpt(body: string, maxLength: number): string {
  const trimmed = body.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

function RankingCard({
  title,
  items,
  metricLabel,
}: {
  title: string;
  items: ArticleRankingItem[];
  metricLabel: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="card">
      <h2 style={{ fontSize: "0.95rem" }}>{title}</h2>
      <div className="ranking-list">
        {items.map((item, i) => (
          <Link key={item.id} href={`/articles/${item.id}`} className="ranking-item">
            <span className="ranking-rank">{i + 1}</span>
            <span className="ranking-body">
              <span className="ranking-title" title={item.title}>
                {ARTICLE_KIND_ICONS[item.kind]} {item.title}
              </span>
              <span className="ranking-meta">
                {metricLabel} {item.metric}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RecentCommentsCard({ items }: { items: RecentCommentItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="card">
      <h2 style={{ fontSize: "0.95rem" }}>💬 最近のコメント</h2>
      <div className="ranking-list">
        {items.map((item) => (
          <Link
            key={item.commentId}
            href={`/articles/${item.articleId}`}
            className="ranking-item"
          >
            <span className="ranking-body">
              <span className="ranking-title" title={item.body}>
                「{excerpt(item.body, COMMENT_EXCERPT_LENGTH)}」
              </span>
              <span className="ranking-meta">
                {ARTICLE_KIND_ICONS[item.articleKind]} {excerpt(item.articleTitle, 24)} ・{" "}
                {formatDateTime(item.createdAt)}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export async function ArticleRankingSidebar() {
  const [popular, mostCommented, recentComments] = await Promise.all([
    findPopularArticlesCached(RANKING_LIMIT),
    findMostCommentedArticlesCached(RANKING_LIMIT),
    findRecentCommentsCached(RECENT_COMMENTS_LIMIT),
  ]);

  return (
    <aside className="articles-sidebar">
      <RankingCard title="🔥 人気記事" items={popular} metricLabel="PV" />
      <RankingCard title="💬 コメントが多い記事" items={mostCommented} metricLabel="コメント" />
      <RecentCommentsCard items={recentComments} />
    </aside>
  );
}
