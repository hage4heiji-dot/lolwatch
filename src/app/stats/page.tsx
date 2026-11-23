import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import {
  getOverviewStats,
  getCategoryBreakdown,
  getVerdictBreakdown,
  getDailyReportCounts,
  getTopChampions,
  getTopReportedPlayers,
  getVoteTotals,
  getReportedTierBreakdown,
} from "@/lib/stats";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/reportCategories";
import { VERDICT_LABELS, VERDICT_ICONS } from "@/lib/moderatorVerdicts";
import { ModeratorVerdict } from "@/generated/prisma";
import {
  DEFAULT_PERIOD_FILTER,
  PERIOD_FILTER_LABELS,
  isPeriodFilter,
  periodFilterSince,
} from "@/lib/periodFilter";

// 日次推移グラフの表示日数。期間フィルタが7日/30日より短い場合はそれに合わせ、
// 「全期間」選択時は見やすさのため直近30日分に固定する。
const DAILY_TREND_DAYS_BY_PERIOD = { week: 7, month: 30, all: 30 } as const;

// モデレーター評価内訳の棒グラフ色。バッジの配色(VERDICT_BADGE_CLASS)と
// 揃え、違反確認は危険色・未評価はニュートラルにして一目で深刻度が分かるようにする。
// 暗いパネル上で見えるよう明るめの色にしている。
const VERDICT_BAR_COLORS: Record<ModeratorVerdict | "UNREVIEWED", string> = {
  UNREVIEWED: "#8a8f9c",
  VIOLATION_CONFIRMED: "#ff5a5f",
  NO_VIOLATION: "#4fd1a5",
  INSUFFICIENT_EVIDENCE: "#7c93ff",
};

// DB通報件数を毎回集計するため、ビルド時の静的プリレンダー対象から外す。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "統計ダッシュボード",
  description:
    "LoLの通報件数推移、カテゴリ別内訳、モデレーター評価の内訳などサイト全体の統計を確認できます。",
};

function BarList({
  rows,
}: {
  rows: { label: string; icon?: string; count: number; color?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="st-bars">
      {rows.map((row) => (
        <div className="stat-bar-row" key={row.label}>
          <span className="stat-bar-label">
            {row.icon ? `${row.icon} ` : ""}
            {row.label}
          </span>
          <div className="stat-bar-track">
            <div
              className="stat-bar-fill"
              style={{
                width: `${(row.count / max) * 100}%`,
                ...(row.color ? { background: row.color } : {}),
              }}
            />
          </div>
          <span className="stat-bar-count">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

function DailyTrend({ rows }: { rows: { date: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((a, r) => a + r.count, 0);
  const peak = rows.reduce(
    (best, r) => (r.count > best.count ? r : best),
    rows[0] ?? { date: "", count: 0 },
  );
  return (
    <div>
      <div className="st-trend-summary">
        <div>
          <span className="st-trend-num">{total}</span>
          <span className="st-trend-unit">件</span>
        </div>
        {peak.count > 0 && (
          <span className="st-trend-peak">
            最多 {peak.date.slice(5)} ・ {peak.count}件
          </span>
        )}
      </div>
      <div className="stat-trend st-trend">
        {rows.map((row) => (
          <div className="stat-trend-col" key={row.date} title={`${row.date}: ${row.count}件`}>
            <div
              className={`stat-trend-bar${row.date === peak.date && peak.count > 0 ? " st-trend-bar-peak" : ""}`}
              style={{ height: `${(row.count / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="stat-trend-labels st-trend-labels">
        <span>{rows[0]?.date}</span>
        <span>{rows[rows.length - 1]?.date}</span>
      </div>
    </div>
  );
}

// 暗いパネル(比較欄の.rq-panelと共通の見た目)。
function Panel({
  kicker,
  title,
  accent,
  note,
  children,
}: {
  kicker: string;
  title: string;
  accent: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="rq-panel st-panel" style={{ "--rq-accent": accent } as CSSProperties}>
      <header className="rq-panel-head">
        <div>
          <span className="rq-panel-kicker">{kicker}</span>
          <h2 className="rq-panel-title">{title}</h2>
        </div>
      </header>
      {note && <p className="rq-note">{note}</p>}
      {children}
    </section>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = periodParam && isPeriodFilter(periodParam) ? periodParam : DEFAULT_PERIOD_FILTER;
  const since = periodFilterSince(period);
  const dailyTrendDays = DAILY_TREND_DAYS_BY_PERIOD[period];

  const [
    overview,
    categories,
    verdicts,
    daily,
    topChampions,
    topPlayers,
    voteTotals,
    tierBreakdown,
  ] = await Promise.all([
    getOverviewStats(since),
    getCategoryBreakdown(since),
    getVerdictBreakdown(since),
    getDailyReportCounts(dailyTrendDays),
    getTopChampions(10, since),
    getTopReportedPlayers(10, since),
    getVoteTotals(since),
    getReportedTierBreakdown(since),
  ]);

  const likeTotal = voteTotals.likeCount + voteTotals.dislikeCount;
  const likeRate = likeTotal > 0 ? Math.round((voteTotals.likeCount / likeTotal) * 100) : null;

  return (
    <div className="st-page">
      <section className="st-hero">
        <p className="st-hero-eyebrow">STATS ・ サイト全体の通報状況</p>
        <h1 className="st-hero-title">統計ダッシュボード</h1>
        <nav className="st-period" aria-label="集計期間">
          {Object.entries(PERIOD_FILTER_LABELS).map(([value, label]) => (
            <Link
              key={value}
              href={value === DEFAULT_PERIOD_FILTER ? "/stats" : `/stats?period=${value}`}
              className={value === period ? "active" : ""}
              aria-current={value === period ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="st-kpis">
          <div className="st-kpi st-kpi-main">
            <span className="st-kpi-label">📋 総通報件数</span>
            <span className="st-kpi-value">{overview.totalReports}</span>
          </div>
          <div className="st-kpi">
            <span className="st-kpi-label">👤 通報された人数</span>
            <span className="st-kpi-value">{overview.reportedPlayerCount}</span>
          </div>
          <div className="st-kpi">
            <span className="st-kpi-label">✅ 評価済み</span>
            <span className="st-kpi-value">{overview.reviewedReportCount}</span>
          </div>
          <div className="st-kpi st-kpi-danger">
            <span className="st-kpi-label">⚠️ 違反確認</span>
            <span className="st-kpi-value">{overview.violationConfirmedCount}</span>
          </div>
          <div className="st-kpi st-kpi-wide">
            <span className="st-kpi-label">⚖️ 違反確認率(評価済みのうち)</span>
            <span className="st-kpi-value">
              {overview.violationConfirmedRate !== null
                ? `${overview.violationConfirmedRate}%`
                : "-"}
            </span>
            <span className="st-meter">
              <i style={{ width: `${overview.violationConfirmedRate ?? 0}%` }} />
            </span>
          </div>
        </div>
        <p className="st-hero-note">
          {PERIOD_FILTER_LABELS[period]}の集計です(非表示にされた通報は含みません)。
        </p>
      </section>

      <Link href="/how-to-check-reports" className="game-cta">
        <span className="game-cta-title">🔍 自分が通報された回数を調べる</span>
        <span className="game-cta-sub">
          Riot IDで検索して通報件数を確認。Riot公式のデータリクエストでの確認方法も解説しています。
        </span>
      </Link>

      <div className="st-grid">
        <Panel kicker="TREND" title={`直近${dailyTrendDays}日の通報件数`} accent="#7c93ff">
          <DailyTrend rows={daily} />
        </Panel>

        <Panel kicker="CATEGORY" title="カテゴリ別内訳" accent="#ff5a5f">
          <BarList
            rows={categories.map((c) => ({
              label: CATEGORY_LABELS[c.category],
              icon: CATEGORY_ICONS[c.category],
              count: c.count,
            }))}
          />
        </Panel>

        <Panel kicker="REVIEW" title="モデレーター評価内訳" accent="#4fd1a5">
          <BarList
            rows={verdicts.map((v) => ({
              label: v.verdict === "UNREVIEWED" ? "未評価" : VERDICT_LABELS[v.verdict],
              icon: v.verdict === "UNREVIEWED" ? "❓" : VERDICT_ICONS[v.verdict],
              count: v.count,
              color: VERDICT_BAR_COLORS[v.verdict],
            }))}
          />
        </Panel>

        <Panel kicker="VOTE" title="コミュニティ評価(妥当/不当投票)" accent="#c8aa6e">
          {likeTotal === 0 ? (
            <p className="rq-note">まだ投票はありません。</p>
          ) : (
            <div className="st-vote">
              <div className="st-vote-labels">
                <span>👍 妥当 {voteTotals.likeCount}</span>
                <span>不当 {voteTotals.dislikeCount} 👎</span>
              </div>
              <div className="st-vote-bar">
                <i className="st-vote-like" style={{ width: `${likeRate}%` }} />
                <i className="st-vote-dislike" style={{ width: `${100 - (likeRate ?? 0)}%` }} />
              </div>
              <div className="st-vote-labels st-vote-rates">
                <span>{likeRate}%</span>
                <span>{100 - (likeRate ?? 0)}%</span>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          kicker="RANK"
          title="通報されたユーザーのランク"
          accent="#c8aa6e"
          note="通報された時点のソロ/デュオランクの分布です。この機能の導入(2026年7月14日)以降に届いた通報のみ対象です。"
        >
          {tierBreakdown.every((t) => t.count === 0) ? (
            <p className="rq-note">まだ集計対象の通報はありません。</p>
          ) : (
            <BarList rows={tierBreakdown.map((t) => ({ label: t.label, count: t.count }))} />
          )}
        </Panel>

        <Panel kicker="CHAMPION" title="通報の多いチャンピオン" accent="#ff9f43">
          {topChampions.length === 0 ? (
            <p className="rq-note">まだ通報はありません。</p>
          ) : (
            <BarList rows={topChampions.map((c) => ({ label: c.name, count: c.count }))} />
          )}
        </Panel>
      </div>

      <Panel kicker="RANKING" title="通報の多いユーザー" accent="#ff5a5f">
        {topPlayers.length === 0 ? (
          <p className="rq-note">まだ通報はありません。</p>
        ) : (
          <ol className="st-ranking">
            {topPlayers.map((player, i) => (
              <li key={player.puuid}>
                <Link href={`/players/${player.puuid}`} className="st-ranking-row">
                  <span className={`st-ranking-pos${i < 3 ? " st-ranking-top" : ""}`}>
                    {i < 3 ? MEDALS[i] : i + 1}
                  </span>
                  <span className="st-ranking-name">{player.displayName}</span>
                  <span className="st-ranking-count">
                    {player.count}
                    <small>件</small>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
