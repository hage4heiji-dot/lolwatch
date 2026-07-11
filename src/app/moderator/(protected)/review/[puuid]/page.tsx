import { notFound } from "next/navigation";
import { findPlayerByPuuid } from "@/lib/playerProfile";
import { getAccountByPuuid, RiotApiError } from "@/lib/riot";
import { CATEGORY_LABELS } from "@/lib/reportCategories";
import { VERDICT_LABELS } from "@/lib/moderatorVerdicts";
import { queueLabel } from "@/lib/matchQueues";
import { formatMatchTime } from "@/lib/matchTime";
import { ReviewForm } from "./review-form";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function ModeratorReviewPage({
  params,
}: {
  params: Promise<{ puuid: string }>;
}) {
  const { puuid } = await params;
  const player = await findPlayerByPuuid(puuid);

  let displayName: string;
  if (player) {
    const current = player.nameHistory.find((n) => n.isCurrent);
    displayName = current ? `${current.riotIdName} #${current.riotIdTagLine}` : puuid;
  } else {
    try {
      const account = await getAccountByPuuid(puuid);
      displayName = `${account.gameName} #${account.tagLine}`;
    } catch (err) {
      if (err instanceof RiotApiError && (err.status === 404 || err.status === 400)) {
        notFound();
      }
      throw err;
    }
  }

  return (
    <div>
      <h1>{displayName} をレビュー</h1>

      <section className="section">
        <h2>一般ユーザーからの通報(未検証・参考情報)</h2>
        {!player || player.reports.length === 0 ? (
          <p className="muted">通報はまだありません。</p>
        ) : (
          player.reports.map((report) => (
            <div className="card" key={report.id}>
              <span className="badge">{CATEGORY_LABELS[report.category]}</span>
              <p style={{ marginTop: "0.5rem" }}>
                対象試合: {report.championName} ・ {queueLabel(report.queueId)} ・ {report.matchId}
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

      {player && player.moderatorReviews.length > 0 && (
        <section className="section">
          <h2>過去のモデレーター評価</h2>
          {player.moderatorReviews.map((review) => (
            <div className="card" key={review.id}>
              <span className="badge badge-verified">{VERDICT_LABELS[review.verdict]}</span>
              <p style={{ marginTop: "0.5rem" }}>{review.rationale}</p>
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                {review.moderator.displayName} ・ {formatDateTime(review.createdAt)}
              </p>
            </div>
          ))}
        </section>
      )}

      <section className="section">
        <h2>新しい評価を登録</h2>
        <ReviewForm puuid={puuid} />
      </section>
    </div>
  );
}
