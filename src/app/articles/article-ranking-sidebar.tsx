import Link from "next/link";
import {
  findPopularArticlesCached,
  findMostCommentedArticlesCached,
  type ArticleRankingItem,
} from "@/lib/articleList";
import { ARTICLE_KIND_ICONS } from "@/lib/articleKind";

const RANKING_LIMIT = 5;

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

export async function ArticleRankingSidebar() {
  const [popular, mostCommented] = await Promise.all([
    findPopularArticlesCached(RANKING_LIMIT),
    findMostCommentedArticlesCached(RANKING_LIMIT),
  ]);

  return (
    <aside className="articles-sidebar">
      <RankingCard title="🔥 人気記事" items={popular} metricLabel="PV" />
      <RankingCard title="💬 コメントが多い記事" items={mostCommented} metricLabel="コメント" />
    </aside>
  );
}
