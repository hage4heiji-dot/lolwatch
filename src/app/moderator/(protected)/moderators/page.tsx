import Link from "next/link";
import { requireModerator } from "@/lib/moderatorAuth";
import { getModeratorStats } from "@/lib/moderatorStats";
import { VERDICT_ICONS } from "@/lib/moderatorVerdicts";

// モデレーターごとの活動量を毎回集計するため、ビルド時の静的プリレンダー対象から外す。
export const dynamic = "force-dynamic";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

export default async function ModeratorStatsPage() {
  const moderator = await requireModerator();

  if (!moderator.isAdmin) {
    return (
      <div>
        <h1>モデレーター別集計</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          このページは管理者権限を持つモデレーターのみ利用できます。
        </p>
      </div>
    );
  }

  const stats = await getModeratorStats();
  const totalReviews = stats.reduce((sum, s) => sum + s.totalReviews, 0);

  return (
    <div>
      <h1>モデレーター別集計</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>
        モデレーターごとのレビュー件数と判定内訳です。
      </p>

      <div className="stat-grid">
        <div className="card stat-card">
          <p className="stat-card-icon">🧑‍⚖️</p>
          <p className="stat-card-value">{stats.length}</p>
          <p className="muted">モデレーター数</p>
        </div>
        <div className="card stat-card">
          <p className="stat-card-icon">📋</p>
          <p className="stat-card-value">{totalReviews}</p>
          <p className="muted">総レビュー件数</p>
        </div>
      </div>

      <section className="section">
        {stats.length === 0 ? (
          <div className="empty-state">
            <p>モデレーターがまだ登録されていません。</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>モデレーター</th>
                  <th>総件数</th>
                  <th>判定内訳</th>
                  <th>最終レビュー日時</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat) => (
                  <tr key={stat.id}>
                    <td>
                      <Link href={`/moderator/moderators/${stat.id}`}>
                        ⚔️ {stat.displayName}
                      </Link>
                      {stat.isAdmin && <span className="muted"> (管理者)</span>}
                    </td>
                    <td>{stat.totalReviews}</td>
                    <td className="muted">
                      {VERDICT_ICONS.VIOLATION_CONFIRMED} {stat.verdictCounts.VIOLATION_CONFIRMED}
                      {"  "}
                      {VERDICT_ICONS.NO_VIOLATION} {stat.verdictCounts.NO_VIOLATION}
                      {"  "}
                      {VERDICT_ICONS.INSUFFICIENT_EVIDENCE} {stat.verdictCounts.INSUFFICIENT_EVIDENCE}
                    </td>
                    <td className="muted">
                      {stat.lastReviewAt ? formatDateTime(stat.lastReviewAt) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
