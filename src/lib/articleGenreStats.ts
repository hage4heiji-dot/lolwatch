// タグ(ジャンル)ごとのPV実績を集計し、UCB1風のスコアで
// 「次に試す価値が高いジャンル」を自動投稿エージェントに提示するためのヘルパー。
// 平均PVだけで判断すると「たまたま1本バズったタグ」が過大評価され、
// 試行回数が少ない未開拓タグが埋もれてしまう。探索ボーナス(サンプルが
// 少ないほど加点)を足すことで、鉄板ジャンルと未開拓ジャンルの両方を
// 提示し、エージェント側の試行錯誤(探索と活用)を後押しする。

export type ArticleForGenreStats = {
  tags: string[];
  pageViews: number;
};

export type TagStat = {
  tag: string;
  articleCount: number;
  totalPageViews: number;
  avgPageViews: number;
  explorationScore: number;
};

// avgPageViewsと同じ桁数感になるよう経験的に設定した探索ボーナスの重み。
const EXPLORATION_WEIGHT = 50;

export function computeTagStats(articles: ArticleForGenreStats[]): TagStat[] {
  const byTag = new Map<string, { count: number; totalPv: number }>();
  let totalTagAssignments = 0;

  for (const article of articles) {
    for (const tag of article.tags) {
      const entry = byTag.get(tag) ?? { count: 0, totalPv: 0 };
      entry.count += 1;
      entry.totalPv += article.pageViews;
      byTag.set(tag, entry);
      totalTagAssignments += 1;
    }
  }

  const stats: TagStat[] = [];
  for (const [tag, { count, totalPv }] of byTag) {
    const avgPageViews = totalPv / count;
    const explorationBonus =
      EXPLORATION_WEIGHT * Math.sqrt(Math.log(totalTagAssignments + 1) / count);
    stats.push({
      tag,
      articleCount: count,
      totalPageViews: totalPv,
      avgPageViews,
      explorationScore: avgPageViews + explorationBonus,
    });
  }

  return stats.sort((a, b) => b.explorationScore - a.explorationScore);
}
