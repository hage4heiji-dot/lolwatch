import Link from "next/link";
import { notFound } from "next/navigation";
import { findPlayerByPuuid } from "@/lib/playerProfile";
import { getAccountByPuuid, RiotApiError } from "@/lib/riot";
import { CATEGORY_LABELS } from "@/lib/reportCategories";
import { VERDICT_LABELS, VERDICT_BADGE_CLASS } from "@/lib/moderatorVerdicts";
import { queueLabel } from "@/lib/matchQueues";
import { formatMatchTime } from "@/lib/matchTime";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ puuid: string }>;
}) {
  const { puuid } = await params;
  const player = await findPlayerByPuuid(puuid);

  if (!player) {
    let displayName: string;
    try {
      const account = await getAccountByPuuid(puuid);
      displayName = `${account.gameName} #${account.tagLine}`;
    } catch (err) {
      if (err instanceof RiotApiError && (err.status === 404 || err.status === 400)) {
        notFound();
      }
      throw err;
    }

    return (
      <div>
        <h1>{displayName}</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          このIDに対する通報はまだありません。
        </p>
        <Link className="btn" style={{ marginTop: "1.5rem", display: "inline-block" }} href="/">
          試合IDから通報する
        </Link>
      </div>
    );
  }

  const currentName = player.nameHistory.find((n) => n.isCurrent);
  const pastNames = player.nameHistory.filter((n) => !n.isCurrent);
  const latestRankCheck = player.rankActivity[0];

  return (
    <div>
      <h1>
        {currentName
          ? `${currentName.riotIdName} #${currentName.riotIdTagLine}`
          : "(表示名不明)"}
      </h1>

      {pastNames.length > 0 && (
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          過去の名前:{" "}
          {pastNames
            .map((n) => `${n.riotIdName} #${n.riotIdTagLine}`)
            .join(", ")}
        </p>
      )}

      {latestRankCheck && (
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          直近のランク参加:{" "}
          {latestRankCheck.isActiveInRanked ? (
            <span style={{ color: "var(--danger)" }}>あり(通報後もランク参加中の可能性)</span>
          ) : (
            "確認できず"
          )}
          {" "}
          (最終確認: {formatDateTime(latestRankCheck.checkedAt)})
        </p>
      )}

      <Link className="btn" style={{ marginTop: "1.5rem", display: "inline-block" }} href="/">
        試合IDから通報する
      </Link>

      <section className="section">
        <h2>
          モデレーター評価{" "}
          <span className="badge badge-verified">検証済み</span>
        </h2>
        {player.moderatorReviews.length === 0 ? (
          <p className="muted">まだモデレーターによる評価はありません。</p>
        ) : (
          player.moderatorReviews.map((review) => (
            <div className="card" key={review.id}>
              <span className={VERDICT_BADGE_CLASS[review.verdict]}>
                {VERDICT_LABELS[review.verdict]}
              </span>
              <p style={{ marginTop: "0.5rem" }}>{review.rationale}</p>
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                {review.moderator.displayName} ・ {formatDateTime(review.createdAt)}
              </p>
            </div>
          ))
        )}
      </section>

      <section className="section">
        <h2>
          一般ユーザーからの通報{" "}
          <span className="badge badge-unverified">未検証</span>
        </h2>
        {player.reports.length === 0 ? (
          <p className="muted">まだ通報はありません。</p>
        ) : (
          player.reports.map((report) => (
            <div className="card" key={report.id}>
              <span className="badge">{CATEGORY_LABELS[report.category]}</span>
              <p style={{ marginTop: "0.5rem" }}>
                対象試合: {report.championName} ・ {queueLabel(report.queueId)}
              </p>
              {report.incidentTimestampSeconds !== null && (
                <p style={{ marginTop: "0.5rem" }}>
                  問題のシーンの目安時間: {formatMatchTime(report.incidentTimestampSeconds)}
                </p>
              )}
              {report.comment && (
                <p style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>{report.comment}</p>
              )}
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                {formatDateTime(report.createdAt)}
              </p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
