// GA4のデータを取得し、新規ユーザー動向を分析するためのレポートを出力するスクリプト。
// 実行: npx tsx scripts/analyze-ga4.ts
import "dotenv/config";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

const propertyId = process.env.GA4_PROPERTY_ID;
if (!propertyId) {
  throw new Error("GA4_PROPERTY_ID が設定されていません");
}

const client = new BetaAnalyticsDataClient();
const property = `properties/${propertyId}`;

function printTable(headers: string[], rows: string[][]) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const line = (cols: string[]) =>
    cols.map((c, i) => c.padEnd(widths[i])).join("  |  ");
  console.log(line(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("--+--"));
  for (const r of rows) console.log(line(r));
  console.log("");
}

async function dailyNewUsersTrend() {
  const [res] = await client.runReport({
    property,
    dateRanges: [{ startDate: "60daysAgo", endDate: "today" }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "newUsers" }, { name: "activeUsers" }, { name: "sessions" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });

  console.log("=== 日別 新規ユーザー数(直近60日) ===");
  const rows = (res.rows ?? []).map((r) => [
    r.dimensionValues?.[0]?.value ?? "",
    r.metricValues?.[0]?.value ?? "0",
    r.metricValues?.[1]?.value ?? "0",
    r.metricValues?.[2]?.value ?? "0",
  ]);
  printTable(["date", "newUsers", "activeUsers", "sessions"], rows);

  // 直近30日と、その前の30日を比較
  const midpoint = rows.length - 30;
  const prev30 = rows.slice(0, midpoint);
  const last30 = rows.slice(midpoint);
  const sum = (arr: string[][], idx: number) =>
    arr.reduce((acc, r) => acc + Number(r[idx] || 0), 0);
  const prevNewUsers = sum(prev30, 1);
  const lastNewUsers = sum(last30, 1);
  const diff = lastNewUsers - prevNewUsers;
  const pct = prevNewUsers === 0 ? "N/A" : ((diff / prevNewUsers) * 100).toFixed(1);
  console.log(
    `直近30日 新規ユーザー: ${lastNewUsers} / 前30日: ${prevNewUsers} / 増減: ${diff >= 0 ? "+" : ""}${diff} (${pct}%)`,
  );
  console.log("");
}

async function channelBreakdown() {
  const [res] = await client.runReport({
    property,
    dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [
      { name: "newUsers" },
      { name: "sessions" },
      { name: "engagementRate" },
      { name: "averageSessionDuration" },
    ],
    orderBys: [{ metric: { metricName: "newUsers" }, desc: true }],
  });

  console.log("=== 集客チャネル別(直近30日) ===");
  const rows = (res.rows ?? []).map((r) => [
    r.dimensionValues?.[0]?.value ?? "",
    r.metricValues?.[0]?.value ?? "0",
    r.metricValues?.[1]?.value ?? "0",
    Number(r.metricValues?.[2]?.value ?? 0).toFixed(2),
    Number(r.metricValues?.[3]?.value ?? 0).toFixed(1) + "s",
  ]);
  printTable(
    ["channel", "newUsers", "sessions", "engagementRate", "avgSessionDuration"],
    rows,
  );
}

async function landingPageBreakdown() {
  const [res] = await client.runReport({
    property,
    dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
    dimensions: [{ name: "landingPage" }],
    metrics: [
      { name: "sessions" },
      { name: "newUsers" },
      { name: "engagementRate" },
      { name: "bounceRate" },
    ],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 20,
  });

  console.log("=== ランディングページ別(直近30日、上位20件) ===");
  const rows = (res.rows ?? []).map((r) => [
    r.dimensionValues?.[0]?.value ?? "",
    r.metricValues?.[0]?.value ?? "0",
    r.metricValues?.[1]?.value ?? "0",
    Number(r.metricValues?.[2]?.value ?? 0).toFixed(2),
    Number(r.metricValues?.[3]?.value ?? 0).toFixed(2),
  ]);
  printTable(
    ["landingPage", "sessions", "newUsers", "engagementRate", "bounceRate"],
    rows,
  );
}

async function deviceBreakdown() {
  const [res] = await client.runReport({
    property,
    dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
    dimensions: [{ name: "deviceCategory" }],
    metrics: [{ name: "newUsers" }, { name: "sessions" }, { name: "engagementRate" }],
    orderBys: [{ metric: { metricName: "newUsers" }, desc: true }],
  });

  console.log("=== デバイス種別(直近30日) ===");
  const rows = (res.rows ?? []).map((r) => [
    r.dimensionValues?.[0]?.value ?? "",
    r.metricValues?.[0]?.value ?? "0",
    r.metricValues?.[1]?.value ?? "0",
    Number(r.metricValues?.[2]?.value ?? 0).toFixed(2),
  ]);
  printTable(["device", "newUsers", "sessions", "engagementRate"], rows);
}

async function main() {
  await dailyNewUsersTrend();
  await channelBreakdown();
  await landingPageBreakdown();
  await deviceBreakdown();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
