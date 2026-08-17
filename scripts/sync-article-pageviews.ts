// GA4の実測PVをArticle.pageViewsに同期するバッチ。タグ別の人気度を集計する
// 土台データとして使う(直近60日のローリング窓。過去にバズったが今は読まれて
// いない記事を「今も強いジャンル」として過大評価しないため)。
// GA4未設定の環境でも安全に実行できるよう、GA4_PROPERTY_ID未設定時は何もしない。
// 実行: npx tsx scripts/sync-article-pageviews.ts
import "dotenv/config";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { prisma } from "../src/lib/prisma";

const propertyId = process.env.GA4_PROPERTY_ID;

async function main() {
  if (!propertyId) {
    console.log("GA4_PROPERTY_ID が未設定のためスキップします。");
    return;
  }

  const client = new BetaAnalyticsDataClient();
  const [res] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "60daysAgo", endDate: "today" }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    dimensionFilter: {
      filter: {
        fieldName: "pagePath",
        stringFilter: { matchType: "BEGINS_WITH", value: "/articles/" },
      },
    },
    limit: 100000,
  });

  const pvByArticleId = new Map<string, number>();
  for (const row of res.rows ?? []) {
    const pagePath = row.dimensionValues?.[0]?.value ?? "";
    const pv = Number(row.metricValues?.[0]?.value ?? 0);
    // "/articles/{id}" 以下にクエリ・末尾スラッシュ等が付いていても記事IDだけ拾う。
    const match = pagePath.match(/^\/articles\/([^/?#]+)/);
    if (!match) continue;
    const articleId = match[1];
    pvByArticleId.set(articleId, (pvByArticleId.get(articleId) ?? 0) + pv);
  }

  const articles = await prisma.article.findMany({ select: { id: true } });

  await prisma.$transaction(
    articles.map((article) =>
      prisma.article.update({
        where: { id: article.id },
        data: { pageViews: pvByArticleId.get(article.id) ?? 0 },
      }),
    ),
  );

  console.log(`${pvByArticleId.size}件の記事にGA4のPVを反映しました(全${articles.length}件中)。`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
