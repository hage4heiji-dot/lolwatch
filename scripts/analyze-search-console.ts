// Search Consoleの検索パフォーマンスを指定期間で出力する分析スクリプト。
// アクセス急増時に「何と検索されて来たか」を調べる用途。
// 実行: npx tsx scripts/analyze-search-console.ts [開始日 YYYY-MM-DD] [終了日 YYYY-MM-DD]
//   日付省略時は直近7日間。日付は太平洋時間(Search Consoleの集計基準)。
//   期間が直近10日以内なら時間帯別の推移(JST表示)も出す。
import "dotenv/config";
import {
  getSearchConsoleSiteUrl,
  querySearchAnalytics,
  type SearchAnalyticsRow,
} from "../src/lib/search-console";

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function printRows(title: string, rows: SearchAnalyticsRow[], label = (keys: string[]) => keys.join(" | ")) {
  console.log(`\n## ${title}`);
  if (rows.length === 0) {
    console.log("(データなし)");
    return;
  }
  console.log("クリック  表示  CTR    順位  キー");
  for (const r of rows) {
    console.log(
      `${String(r.clicks).padStart(6)}  ${String(r.impressions).padStart(5)}  ${(r.ctr * 100)
        .toFixed(1)
        .padStart(5)}%  ${r.position.toFixed(1).padStart(4)}  ${label(r.keys)}`,
    );
  }
}

// "2026-11-19T16:00:00-08:00" → "11/20 09時(JST)"
function formatHourJst(value: string): string {
  const d = new Date(new Date(value).getTime() + 9 * 3600 * 1000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}時(JST)`;
}

async function main() {
  const today = new Date();
  const startDate = process.argv[2] ?? ymd(new Date(today.getTime() - 7 * 86400 * 1000));
  const endDate = process.argv[3] ?? process.argv[2] ?? ymd(today);
  const range = { startDate, endDate, dataState: "all" as const };

  console.log(`Search Console: ${await getSearchConsoleSiteUrl()} / ${startDate} 〜 ${endDate}`);

  printRows("検索キーワード(クリック順)", await querySearchAnalytics({ ...range, dimensions: ["query"], rowLimit: 30 }));
  printRows(
    "検索キーワード(表示回数順)",
    await querySearchAnalytics({ ...range, dimensions: ["query"], rowLimit: 30, orderByImpressions: true }),
  );
  printRows("ページ", await querySearchAnalytics({ ...range, dimensions: ["page"], rowLimit: 20 }));
  printRows("キーワード × 着地ページ", await querySearchAnalytics({ ...range, dimensions: ["query", "page"], rowLimit: 30 }));
  printRows("デバイス", await querySearchAnalytics({ ...range, dimensions: ["device"] }));

  // 時間別データはAPIの仕様上、直近10日分しか取れない。
  if (Date.now() - new Date(startDate).getTime() <= 10 * 86400 * 1000) {
    const hourly = await querySearchAnalytics({
      ...range,
      dimensions: ["hour"],
      dataState: "hourly_all",
      rowLimit: 500,
    });
    hourly.sort((a, b) => a.keys[0].localeCompare(b.keys[0]));
    printRows(
      "時間帯別",
      hourly.filter((r) => r.impressions > 0),
      (keys) => formatHourJst(keys[0]),
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
