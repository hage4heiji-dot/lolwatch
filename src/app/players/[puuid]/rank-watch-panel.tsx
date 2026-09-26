import { formatRelativeTime } from "@/lib/relativeTime";
import { MIN_DAYS_SINCE_REPORT } from "@/lib/rankWatchStats";
import { CountUp } from "@/app/count-up";

const DAY_MS = 24 * 60 * 60 * 1000;

// 最新の通報から何日経ったか(ページはリクエストごとに描画されるので現在時刻基準でよい)。
function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / DAY_MS);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

// プレイヤーページの「ランク参加監視」パネル。トップページの監視ボード(rank-watch-board.tsx)と
// 同じ基準で、このプレイヤーが通報後にランク戦へ出場しているかを状態ごとに大きく見せる。
//
// - eradicated: 最新の通報からMIN_DAYS_SINCE_REPORT日以上、ランク出場なし(=撲滅数に数えられる)
// - watching:   最新の通報以降ランク出場なしだが、まだMIN_DAYS_SINCE_REPORT日経っていない
// - active:     最新の通報以降にランク出場あり
// - unknown:    通報以降の出場を記録する前のチェック結果しかない(直近の出場有無のみ表示)
export function RankWatchPanel({
  check,
  latestReportAt,
  firstReportAt,
}: {
  check: { checkedAt: Date; isActiveInRanked: boolean; hasRankedSinceReport: boolean | null };
  latestReportAt: Date | null;
  firstReportAt: Date | null;
}) {
  const daysSinceReport = latestReportAt ? daysSince(latestReportAt) : null;

  let state: "eradicated" | "watching" | "active" | "unknown" = "unknown";
  if (check.hasRankedSinceReport === true) {
    state = "active";
  } else if (check.hasRankedSinceReport === false && daysSinceReport !== null) {
    state = daysSinceReport >= MIN_DAYS_SINCE_REPORT ? "eradicated" : "watching";
  }

  const recentLabel = `直近${MIN_DAYS_SINCE_REPORT}日間`;

  return (
    <section className={`player-watch player-watch-${state}`} aria-labelledby="player-watch-status">
      <p className="rank-watch-eyebrow">
        <span className="rank-watch-live-dot" aria-hidden="true"></span>
        LIVE ｜ ランク参加監視
      </p>

      {state === "eradicated" && (
        <>
          <p id="player-watch-status" className="player-watch-status">⚔️ トロール撲滅</p>
          <p className="player-watch-value">
            <CountUp value={daysSinceReport!} />
            <span className="player-watch-unit">日間</span>
          </p>
          <p className="player-watch-caption">通報されてから、ランク戦に一度も姿を見せていません</p>
        </>
      )}

      {state === "watching" && (
        <>
          <p id="player-watch-status" className="player-watch-status">👁️ 監視中</p>
          <p className="player-watch-value">
            {daysSinceReport === 0 ? (
              <span className="player-watch-value-text">通報から1日未満</span>
            ) : (
              <>
                <CountUp value={daysSinceReport!} />
                <span className="player-watch-unit">日間</span>
              </>
            )}
          </p>
          <p className="player-watch-caption">
            通報後、まだランク戦への出場はありません。{MIN_DAYS_SINCE_REPORT}
            日間出場がなければ「トロール撲滅」に数えられます
          </p>
        </>
      )}

      {state === "active" && (
        <>
          <p id="player-watch-status" className="player-watch-status">⚠️ 通報後もランク戦に出場</p>
          <p className="player-watch-value">
            <span className="player-watch-value-text">
              {check.isActiveInRanked ? "出場中" : "出場あり"}
            </span>
          </p>
          <p className="player-watch-caption">
            {check.isActiveInRanked
              ? `通報後もランク戦に出場しており、${recentLabel}にも出場を確認しています`
              : `通報後にランク戦への出場がありました(${recentLabel}は出場なし)`}
          </p>
        </>
      )}

      {state === "unknown" && (
        <>
          <p id="player-watch-status" className="player-watch-status">👁️ 監視中</p>
          <p className="player-watch-value">
            <span className="player-watch-value-text">
              {check.isActiveInRanked ? "出場あり" : "出場なし"}
            </span>
          </p>
          <p className="player-watch-caption">{recentLabel}のランク戦への出場状況です</p>
        </>
      )}

      <dl className="player-watch-meta">
        {firstReportAt && (
          <div>
            <dt>監視開始</dt>
            <dd>{formatDate(firstReportAt)}</dd>
          </div>
        )}
        {latestReportAt && (
          <div>
            <dt>最新の通報</dt>
            <dd>{formatDate(latestReportAt)}</dd>
          </div>
        )}
        <div>
          <dt>最終チェック</dt>
          <dd>{formatRelativeTime(check.checkedAt)}</dd>
        </div>
        <div>
          <dt>チェック間隔</dt>
          <dd>6時間ごと (Riot API)</dd>
        </div>
      </dl>
    </section>
  );
}
