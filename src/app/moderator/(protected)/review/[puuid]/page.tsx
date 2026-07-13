import { notFound } from "next/navigation";
import { findPlayerByPuuid } from "@/lib/playerProfile";
import { getAccountByPuuid, RiotApiError } from "@/lib/riot";
import { getSessionModerator } from "@/lib/moderatorAuth";
import { CATEGORY_LABELS } from "@/lib/reportCategories";
import { queueLabel } from "@/lib/matchQueues";
import { formatMatchTime } from "@/lib/matchTime";
import { ReviewForm } from "./review-form";
import { ModeratorReviewCard } from "./review-card";
import { HideReportControl } from "./hide-report-control";

function replayScriptHref(matchId: string, incidentTimestampSeconds: number | null): string {
  const base = `/api/moderator/replay-script/${encodeURIComponent(matchId)}`;
  return incidentTimestampSeconds !== null
    ? `${base}?t=${incidentTimestampSeconds}`
    : base;
}

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
  const player = await findPlayerByPuuid(puuid, { includeHidden: true });
  const moderator = await getSessionModerator();

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
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
        評価は通報(=試合)ごとに登録します。試合を実際に確認した上で、該当する通報に対して判定を残してください。
      </p>

      <section className="section">
        <h2>通報一覧</h2>
        {!player || player.reports.length === 0 ? (
          <p className="muted">通報はまだありません。評価できる対象がないため、このページでは何もできません。</p>
        ) : (
          player.reports.map((report) => (
            <div className="card" key={report.id} style={report.hiddenAt ? { opacity: 0.6 } : undefined}>
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
              <p style={{ marginTop: "0.5rem" }}>
                <a
                  className="btn btn-secondary"
                  style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                  href={replayScriptHref(report.matchId, report.incidentTimestampSeconds)}
                  download
                >
                  リプレイ起動スクリプトをダウンロード(.ps1)
                </a>
                <span className="muted" style={{ display: "block", marginTop: "0.35rem" }}>
                  手元のPCでLeagueクライアントにログインした状態で実行してください。未検証の仕組みのため、動作しない場合があります。リプレイにはチャットログ等は記録されません。
                </span>
              </p>
              {report.videoUrl ? (
                <p style={{ marginTop: "0.5rem" }}>
                  <a
                    className="btn btn-secondary"
                    style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                    href={report.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    通報者が添付した動画を見る
                  </a>
                  <span className="muted" style={{ display: "block", marginTop: "0.35rem" }}>
                    チャット等、リプレイに残らない証跡はこちらで確認してください。
                  </span>
                </p>
              ) : (
                <p className="muted" style={{ marginTop: "0.5rem" }}>
                  動画は添付されていません(チャット等が争点の場合、リプレイのみでは確認できません)。
                </p>
              )}
              {report.imageUrl && (
                <p style={{ marginTop: "0.5rem" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 任意の外部ホストの画像なのでnext/imageのremotePatternsに載せられない */}
                  <img
                    src={report.imageUrl}
                    alt="通報者が添付した画像"
                    style={{ maxWidth: "100%", maxHeight: "320px", borderRadius: "6px" }}
                  />
                </p>
              )}

              {moderator?.isAdmin ? (
                <HideReportControl
                  reportId={report.id}
                  puuid={puuid}
                  hiddenAt={report.hiddenAt ? report.hiddenAt.toISOString() : null}
                  hiddenReason={report.hiddenReason}
                />
              ) : (
                report.hiddenAt && (
                  <p className="muted" style={{ marginTop: "0.5rem" }}>
                    この通報は非表示になっています{report.hiddenReason ? `(理由: ${report.hiddenReason})` : ""}。
                  </p>
                )
              )}

              {report.moderatorReviews.length > 0 && (
                <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
                  <p className="muted" style={{ marginBottom: "0.35rem" }}>この通報への評価:</p>
                  {report.moderatorReviews.map((review) => (
                    <ModeratorReviewCard
                      key={review.id}
                      reviewId={review.id}
                      puuid={puuid}
                      verdict={review.verdict}
                      rationale={review.rationale}
                      moderatorDisplayName={review.moderator.displayName}
                      createdAtLabel={formatDateTime(review.createdAt)}
                      canEdit={review.moderatorId === moderator?.id}
                    />
                  ))}
                </div>
              )}

              <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
                <p className="muted" style={{ marginBottom: "0.5rem" }}>
                  {report.moderatorReviews.length > 0 ? "この通報を再評価する" : "この通報を評価する"}
                </p>
                <ReviewForm reportId={report.id} puuid={puuid} />
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
