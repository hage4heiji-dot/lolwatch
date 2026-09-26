import { getRankWatchStats } from "@/lib/rankWatchStats";
import { CountUp } from "./count-up";

function formatRelative(date: Date): string {
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

// トップページの「ランク参加監視」ボード。通報されたプレイヤーを定期的に監視していることと、
// その成果(通報後ランクに参加できていない人数)を大きく見せる。
export async function RankWatchBoard() {
  const stats = await getRankWatchStats();
  if (stats.monitoredCount === 0) return null;

  const rate = Math.round((stats.eradicatedCount / stats.monitoredCount) * 100);

  return (
    <section className="rank-watch" aria-labelledby="rank-watch-title">
      <p className="rank-watch-eyebrow">
        <span className="rank-watch-live-dot" aria-hidden="true"></span>
        LIVE ｜ ランク参加監視システム
      </p>
      <h2 id="rank-watch-title" className="rank-watch-title">
        通報されたプレイヤーは、<span className="rank-watch-title-accent">監視されている。</span>
      </h2>

      <div className="rank-watch-stats">
        <div className="rank-watch-stat">
          <span className="rank-watch-stat-label">👁️ 監視中のプレイヤー</span>
          <span className="rank-watch-stat-value">
            <CountUp value={stats.monitoredCount} />
            <span className="rank-watch-stat-unit">人</span>
          </span>
          <span className="rank-watch-stat-note">Riot APIで6時間ごとにランク戦への出場をチェック</span>
        </div>
        <div className="rank-watch-stat rank-watch-stat-accent">
          <span className="rank-watch-stat-label">⚔️ トロール撲滅数</span>
          <span className="rank-watch-stat-value">
            <CountUp value={stats.eradicatedCount} />
            <span className="rank-watch-stat-unit">人</span>
          </span>
          <span className="rank-watch-stat-note">通報されて以降、ランク戦に一度も姿を見せていないプレイヤー</span>
        </div>
      </div>

      <div className="rank-watch-meter">
        <div className="rank-watch-meter-head">
          <span>撲滅率</span>
          <span className="rank-watch-meter-rate">{rate}%</span>
        </div>
        <div
          className="rank-watch-meter-track"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rate}
          aria-label="撲滅率"
        >
          <div className="rank-watch-meter-fill" style={{ width: `${rate}%` }}></div>
        </div>
      </div>

      <p className="rank-watch-footnote">
        {stats.lastCheckedAt ? `最終チェック: ${formatRelative(stats.lastCheckedAt)} ・ ` : ""}
        撲滅数は、最新の通報から{stats.minDaysSinceReport}日以上経ったプレイヤーが対象です
      </p>
    </section>
  );
}
