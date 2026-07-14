import Link from "next/link";
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
const VERDICT_BAR_COLORS: Record<ModeratorVerdict | "UNREVIEWED", string> = {
  UNREVIEWED: "var(--muted)",
  VIOLATION_CONFIRMED: "var(--danger)",
  NO_VIOLATION: "var(--kill-color)",
  INSUFFICIENT_EVIDENCE: "var(--accent)",
};

// DB通報件数を毎回集計するため、ビルド時の静的プリレンダー対象から外す。
export const dynamic = "force-dynamic";

function BarList({
  rows,
}: {
  rows: { label: string; icon?: string; count: number; color?: string }[];
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
              style={{ width: `${(row.count / max) * 100}%`, background: row.color }}
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

  const [overview, categories, verdicts, daily, topChampions, topPlayers, voteTotals, tierBreakdown] =
    await Promise.all([
      getOverviewStats(since),
      getCategoryBreakdown(since),
      getVerdictBreakdown(since),
      getDailyReportCounts(dailyTrendDays),
      getTopChampions(10, since),
      getTopReportedPlayers(10, since),
      getVoteTotals(since),
      getReportedTierBreakdown(since),
    ]);

  return (
    <div>
      <h1>統計ダッシュボード</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>
        サイト全体の通報状況の集計です。
      </p>

      <form style={{ marginBottom: "1.5rem" }}>
        <div className="form-row" style={{ alignItems: "flex-end" }}>
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
        </div>
        <div className="form-actions">
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
        以下は{PERIOD_FILTER_LABELS[period]}の集計です(非表示にされた通報は含みません)。
      </p>
      <div className="stat-grid">
        <div className="card stat-card">
          <p className="stat-card-icon">📋</p>
          <p className="stat-card-value">{overview.totalReports}</p>
          <p className="muted">総通報件数</p>
        </div>
        <div className="card stat-card">
          <p className="stat-card-icon">👤</p>
          <p className="stat-card-value">{overview.reportedPlayerCount}</p>
          <p className="muted">通報された人数</p>
        </div>
        <div className="card stat-card">
          <p className="stat-card-icon">✅</p>
          <p className="stat-card-value">{overview.reviewedReportCount}</p>
          <p className="muted">モデレーター評価済み</p>
        </div>
        <div className="card stat-card">
          <p className="stat-card-icon">⚠️</p>
          <p className="stat-card-value stat-card-value-danger">{overview.violationConfirmedCount}</p>
          <p className="muted">違反確認件数</p>
        </div>
        <div className="card stat-card">
          <p className="stat-card-icon">⚖️</p>
          <p className="stat-card-value">
            {overview.violationConfirmedRate !== null ? `${overview.violationConfirmedRate}%` : "-"}
          </p>
          <p className="muted">違反確認率(評価済み中)</p>
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
              color: VERDICT_BAR_COLORS[v.verdict],
            }))}
          />
        </div>
      </section>

      <section className="section">
        <h2>コミュニティ評価(妥当/不当投票)</h2>
        <div className="card">
          <BarList
            rows={[
              { label: "妥当", icon: "👍", count: voteTotals.likeCount, color: "var(--accent)" },
              { label: "不当", icon: "👎", count: voteTotals.dislikeCount, color: "var(--danger)" },
            ]}
          />
        </div>
      </section>

      <section className="section">
        <h2>通報されたユーザーのランク</h2>
        <p className="muted" style={{ marginBottom: "0.75rem" }}>
          通報された時点のソロ/デュオランクの分布です。この機能の導入(2026年7月14日)以降に届いた通報のみ対象です。
        </p>
        <div className="card">
          {tierBreakdown.every((t) => t.count === 0) ? (
            <div className="empty-state">
              <p>まだ集計対象の通報はありません。</p>
            </div>
          ) : (
            <BarList rows={tierBreakdown.map((t) => ({ label: t.label, count: t.count }))} />
          )}
        </div>
      </section>

      <section className="section">
        <h2>通報の多いチャンピオン</h2>
        <div className="card">
          {topChampions.length === 0 ? (
            <div className="empty-state">
              <p>まだ通報はありません。</p>
            </div>
          ) : (
            <BarList rows={topChampions.map((c) => ({ label: c.name, count: c.count }))} />
          )}
        </div>
      </section>

      <section className="section">
        <h2>通報の多いユーザー</h2>
        {topPlayers.length === 0 ? (
          <div className="empty-state">
            <p>まだ通報はありません。</p>
          </div>
        ) : (
          topPlayers.map((player, i) => (
            <div
              className="card"
              key={player.puuid}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                <span className="rank-badge">{i + 1}</span>
                <Link href={`/players/${player.puuid}`}>{player.displayName}</Link>
              </div>
              <span className="muted" style={{ flexShrink: 0 }}>
                通報件数: {player.count}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
