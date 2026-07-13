import Link from "next/link";
import {
  getOverviewStats,
  getCategoryBreakdown,
  getVerdictBreakdown,
  getDailyReportCounts,
  getTopChampions,
  getTopReportedPlayers,
} from "@/lib/stats";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/reportCategories";
import { VERDICT_LABELS, VERDICT_ICONS } from "@/lib/moderatorVerdicts";
import {
  DEFAULT_PERIOD_FILTER,
  PERIOD_FILTER_LABELS,
  isPeriodFilter,
  periodFilterSince,
} from "@/lib/periodFilter";

// 日次推移グラフの表示日数。期間フィルタが7日/30日より短い場合はそれに合わせ、
// 「全期間」選択時は見やすさのため直近30日分に固定する。
const DAILY_TREND_DAYS_BY_PERIOD = { week: 7, month: 30, all: 30 } as const;

// DB通報件数を毎回集計するため、ビルド時の静的プリレンダー対象から外す。
export const dynamic = "force-dynamic";

function BarList({
  rows,
}: {
  rows: { label: string; icon?: string; count: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div>
      {rows.map((row) => (
        <div className="stat-bar-row" key={row.label}>
          <span className="stat-bar-label">
            {row.icon ? `${row.icon} ` : ""}
            {row.label}
          </span>
          <div className="stat-bar-track">
            <div
              className="stat-bar-fill"
              style={{ width: `${(row.count / max) * 100}%` }}
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
  return (
    <div>
      <div className="stat-trend">
        {rows.map((row) => (
          <div className="stat-trend-col" key={row.date} title={`${row.date}: ${row.count}件`}>
            <div
              className="stat-trend-bar"
              style={{ height: `${(row.count / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="stat-trend-labels muted">
        <span>{rows[0]?.date}</span>
        <span>{rows[rows.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = periodParam && isPeriodFilter(periodParam) ? periodParam : DEFAULT_PERIOD_FILTER;
  const since = periodFilterSince(period);
  const dailyTrendDays = DAILY_TREND_DAYS_BY_PERIOD[period];

  const [overview, categories, verdicts, daily, topChampions, topPlayers] = await Promise.all([
    getOverviewStats(since),
    getCategoryBreakdown(since),
    getVerdictBreakdown(since),
    getDailyReportCounts(dailyTrendDays),
    getTopChampions(10, since),
    getTopReportedPlayers(10, since),
  ]);

  return (
    <div>
      <h1>統計ダッシュボード</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>
        サイト全体の通報状況の集計です(非表示にされた通報は含みません)。
      </p>

      <form className="form-row" style={{ marginBottom: "1.5rem", alignItems: "flex-end" }}>
        <div className="form-field">
          <label htmlFor="period">期間</label>
          <select id="period" name="period" defaultValue={period}>
            {Object.entries(PERIOD_FILTER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn" type="submit">
            適用
          </button>
          {period !== DEFAULT_PERIOD_FILTER && (
            <Link className="btn btn-secondary" href="/stats">
              条件をクリア
            </Link>
          )}
        </div>
      </form>

      <p className="muted" style={{ marginBottom: "0.5rem" }}>
        以下は{PERIOD_FILTER_LABELS[period]}の集計です。
      </p>
      <div className="stat-grid">
        <div className="card stat-card">
          <p className="stat-card-value">{overview.totalReports}</p>
          <p className="muted">総通報件数</p>
        </div>
        <div className="card stat-card">
          <p className="stat-card-value">{overview.reportedPlayerCount}</p>
          <p className="muted">通報された人数</p>
        </div>
        <div className="card stat-card">
          <p className="stat-card-value">{overview.reviewedReportCount}</p>
          <p className="muted">モデレーター評価済み</p>
        </div>
        <div className="card stat-card">
          <p className="stat-card-value">{overview.violationConfirmedCount}</p>
          <p className="muted">違反確認件数</p>
        </div>
      </div>

      <section className="section">
        <h2>直近{dailyTrendDays}日の通報件数推移</h2>
        <div className="card">
          <DailyTrend rows={daily} />
        </div>
      </section>

      <section className="section">
        <h2>カテゴリ別内訳</h2>
        <div className="card">
          <BarList
            rows={categories.map((c) => ({
              label: CATEGORY_LABELS[c.category],
              icon: CATEGORY_ICONS[c.category],
              count: c.count,
            }))}
          />
        </div>
      </section>

      <section className="section">
        <h2>モデレーター評価内訳</h2>
        <div className="card">
          <BarList
            rows={verdicts.map((v) => ({
              label: v.verdict === "UNREVIEWED" ? "未評価" : VERDICT_LABELS[v.verdict],
              icon: v.verdict === "UNREVIEWED" ? "❓" : VERDICT_ICONS[v.verdict],
              count: v.count,
            }))}
          />
        </div>
      </section>

      <section className="section">
        <h2>通報の多いチャンピオン</h2>
        <div className="card">
          {topChampions.length === 0 ? (
            <p className="muted">まだ通報はありません。</p>
          ) : (
            <BarList rows={topChampions.map((c) => ({ label: c.name, count: c.count }))} />
          )}
        </div>
      </section>

      <section className="section">
        <h2>通報の多いユーザー</h2>
        {topPlayers.length === 0 ? (
          <p className="muted">まだ通報はありません。</p>
        ) : (
          topPlayers.map((player) => (
            <div
              className="card"
              key={player.puuid}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <Link href={`/players/${player.puuid}`}>{player.displayName}</Link>
              <span className="muted">通報件数: {player.count}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
