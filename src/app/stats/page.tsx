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

export default async function StatsPage() {
  const [overview, categories, verdicts, daily, topChampions, topPlayers] = await Promise.all([
    getOverviewStats(),
    getCategoryBreakdown(),
    getVerdictBreakdown(),
    getDailyReportCounts(),
    getTopChampions(),
    getTopReportedPlayers(),
  ]);

  return (
    <div>
      <h1>統計ダッシュボード</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
        サイト全体の通報状況の集計です(非表示にされた通報は含みません)。
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
        <h2>直近30日の通報件数推移</h2>
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
