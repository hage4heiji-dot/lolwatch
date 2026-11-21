// 前日(GA4プロパティのタイムゾーン基準)のサイト訪問者数などをGA4から取得し、
// 管理者用Discordの「サイトの動き」チャンネルへ日次レポートとして投稿するバッチ。
// 実行: npx tsx scripts/post-daily-site-stats.ts
// workerでは毎日 09:05 JST に1回だけ実行する(docker-compose.yml参照)。起動直後には
// 実行しないため、デプロイでコンテナを作り直しても二重投稿にはならない。
import "dotenv/config";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import {
  DISCORD_COLORS,
  discordCodeBlock,
  notifyDiscord,
} from "../src/lib/discord";
import { querySearchAnalytics } from "../src/lib/search-console";

const propertyId = process.env.GA4_PROPERTY_ID;
const TOP_PAGES = 5;
const TOP_CHANNELS = 4;
const TOP_QUERIES = 5;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

type DailyTotals = { users: number; newUsers: number; sessions: number; pageViews: number };

// "20260925" → "9/25(金)"
function formatGaDate(value: string): string {
  const date = new Date(Date.UTC(+value.slice(0, 4), +value.slice(4, 6) - 1, +value.slice(6, 8)));
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}(${WEEKDAYS[date.getUTCDay()]})`;
}

// 前日比を「123人 (▲12)」の形で添える。
function withDiff(current: number, previous: number | undefined, unit: string): string {
  const base = `**${current.toLocaleString("ja-JP")}**${unit}`;
  if (previous === undefined) return base;
  const diff = current - previous;
  if (diff === 0) return `${base} (±0)`;
  return `${base} (${diff > 0 ? "▲" : "▼"}${Math.abs(diff).toLocaleString("ja-JP")})`;
}

// タイトル末尾のサイト名(" | lolwatch"等)は一覧で冗長なので落とす。
function shortenPageTitle(title: string, path: string): string {
  const trimmed = title.replace(/\s*[|｜-]\s*lolwatch\s*$/i, "").trim();
  return trimmed || path;
}

// Google検索キーワード上位をSearch Consoleから取得する。Search Consoleは太平洋時間で
// 日を区切るため、実行時点(09:05 JST = 前日16:05 PT頃)で最後まで集計が済んでいる
// 「太平洋時間の前日」を対象にする(JSTでは前々日17時〜前日17時に相当)。
// 未設定・権限不足でもGA4のレポート自体は投稿したいので、失敗時は理由を文字列で返す。
async function fetchTopQueries(): Promise<{ label: string; value: string }> {
  const pacificToday = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const target = new Date(Date.parse(pacificToday) - 86400 * 1000).toISOString().slice(0, 10);
  const label = `🔎 Google検索キーワード (${formatGaDate(target.replaceAll("-", ""))} 太平洋時間)`;
  try {
    const rows = await querySearchAnalytics({
      startDate: target,
      endDate: target,
      dimensions: ["query"],
      rowLimit: TOP_QUERIES,
      dataState: "all",
    });
    if (rows.length === 0) return { label, value: "(データなし)" };
    const lines = rows.map(
      (r, i) => `${i + 1}. ${r.keys[0]} — ${r.clicks}クリック / ${r.impressions}表示`,
    );
    return { label, value: lines.join("\n") };
  } catch (err) {
    console.error("Search Consoleの取得に失敗:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { label, value: `取得失敗: ${message.slice(0, 200)}` };
  }
}

async function main() {
  if (!propertyId) {
    console.log("GA4_PROPERTY_ID が未設定のためスキップします。");
    return;
  }

  const client = new BetaAnalyticsDataClient();
  const property = `properties/${propertyId}`;

  const [[totalsRes], [pagesRes], [channelsRes], topQueries] = await Promise.all([
    client.runReport({
      property,
      dateRanges: [{ startDate: "2daysAgo", endDate: "yesterday" }],
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "activeUsers" },
        { name: "newUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
      ],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
    client.runReport({
      property,
      dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [{ name: "screenPageViews" }],
      // 管理画面の閲覧は訪問者の動向ではないため除外する。
      dimensionFilter: {
        notExpression: {
          filter: {
            fieldName: "pagePath",
            stringFilter: { matchType: "BEGINS_WITH", value: "/moderator" },
          },
        },
      },
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: TOP_PAGES,
    }),
    client.runReport({
      property,
      dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: TOP_CHANNELS,
    }),
    fetchTopQueries(),
  ]);

  const totalsByDate = new Map<string, DailyTotals>();
  for (const row of totalsRes.rows ?? []) {
    const [users, newUsers, sessions, pageViews] = (row.metricValues ?? []).map((m) =>
      Number(m.value ?? 0),
    );
    totalsByDate.set(row.dimensionValues?.[0]?.value ?? "", { users, newUsers, sessions, pageViews });
  }
  // 訪問ゼロの日は行自体が返らないため、日付の並びから前日・前々日を判定する。
  const dates = Array.from(totalsByDate.keys()).sort();
  const targetDate = dates.at(-1);
  const zero: DailyTotals = { users: 0, newUsers: 0, sessions: 0, pageViews: 0 };
  const today = targetDate ? totalsByDate.get(targetDate)! : zero;
  const previous = dates.length >= 2 ? totalsByDate.get(dates[0]) : undefined;

  const topPages = (pagesRes.rows ?? []).map((row, i) => {
    const path = row.dimensionValues?.[0]?.value ?? "";
    const title = shortenPageTitle(row.dimensionValues?.[1]?.value ?? "", path);
    const pv = Number(row.metricValues?.[0]?.value ?? 0);
    return `${i + 1}. ${title} — ${pv}PV`;
  });

  const channels = (channelsRes.rows ?? []).map(
    (row) => `${row.dimensionValues?.[0]?.value ?? ""}: ${row.metricValues?.[0]?.value ?? 0}`,
  );

  const dateLabel = targetDate ? formatGaDate(targetDate) : "前日";
  console.log(
    `${dateLabel}: 訪問者${today.users}人 / 新規${today.newUsers}人 / ${today.pageViews}PV / ${today.sessions}セッション`,
  );

  await notifyDiscord("activity", {
    label: "📊 日次レポート",
    title: `${dateLabel}のサイト訪問者数`,
    color: DISCORD_COLORS.blue,
    fields: [
      { name: "👥 訪問者", value: withDiff(today.users, previous?.users, "人"), inline: true },
      { name: "🆕 新規", value: withDiff(today.newUsers, previous?.newUsers, "人"), inline: true },
      { name: "📄 ページビュー", value: withDiff(today.pageViews, previous?.pageViews, "PV"), inline: true },
      { name: "🔥 よく見られたページ", value: topPages.join("\n") },
      { name: "🧭 流入元 (セッション数)", value: channels.join(" / ") },
      { name: topQueries.label, value: topQueries.value },
    ],
  });
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await notifyDiscord("batch", {
    label: "❌ 失敗",
    title: "サイト訪問者数の日次レポート",
    color: DISCORD_COLORS.red,
    description: discordCodeBlock(err instanceof Error ? (err.stack ?? err.message) : String(err)),
  });
});
