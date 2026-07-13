import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { findPlayerByPuuid } from "@/lib/playerProfile";
import {
  getAccountByPuuid,
  getLatestDdragonVersion,
  getLeagueEntriesByPuuid,
  getMatchDetail,
  RiotApiError,
} from "@/lib/riot";
import { FALLBACK_DDRAGON_VERSION } from "@/lib/ddragon";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/reportCategories";
import { VERDICT_LABELS, VERDICT_BADGE_CLASS, VERDICT_ICONS } from "@/lib/moderatorVerdicts";
import { queueLabel } from "@/lib/matchQueues";
import { QUEUE_TYPE_LABELS, formatRank } from "@/lib/rankLabel";
import { formatMatchTime } from "@/lib/matchTime";
import { DEVICE_ID_COOKIE } from "@/lib/deviceId";
import { canEditReport } from "@/lib/reportEdit";
import { ReportVoteButtons } from "@/app/report-vote-buttons";
import { ReviewObjectionButton } from "@/app/review-objection-button";
import { ReportEditForm } from "@/app/report-edit-form";
import { MatchScoreboard } from "@/app/match-scoreboard";

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
  const cookieStore = await cookies();
  const deviceId = cookieStore.get(DEVICE_ID_COOKIE)?.value ?? null;

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

  // ランクや試合結果はRiot APIの補助情報。取得に失敗しても通報一覧自体は表示できるよう、
  // 個別にcatchしてページ全体を落とさない(api/matches/[matchId]と同じ方針)。
  const leagueEntries = await getLeagueEntriesByPuuid(player.puuid, player.platform).catch(
    () => [],
  );

  const uniqueMatchIds = [...new Set(player.reports.map((r) => r.matchId))];
  const [matchDetailResults, ddragonVersion] = await Promise.all([
    Promise.allSettled(uniqueMatchIds.map(getMatchDetail)),
    getLatestDdragonVersion().catch(() => FALLBACK_DDRAGON_VERSION),
  ]);
  const matchDetailByMatchId = new Map<string, Awaited<ReturnType<typeof getMatchDetail>>>();
  matchDetailResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      matchDetailByMatchId.set(uniqueMatchIds[i], result.value);
    }
  });

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

      {leagueEntries.length > 0 && (
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          現在のランク:{" "}
          {leagueEntries
            .map((entry) => `${QUEUE_TYPE_LABELS[entry.queueType] ?? entry.queueType} ${formatRank(entry)}`)
            .join(" ・ ")}
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
          試合ごとの通報{" "}
          <span className="badge badge-unverified">通報自体は未検証</span>
        </h2>
        <p className="muted" style={{ marginBottom: "0.75rem" }}>
          「モデレーター評価」が付いている試合は、運営が実際にリプレイ等を確認した上での判定です。付いていない試合は一般ユーザーからの未検証の通報のみです。
        </p>
        {player.reports.length === 0 ? (
          <p className="muted">まだ通報はありません。</p>
        ) : (
          player.reports.map((report) => {
            const matchDetail = matchDetailByMatchId.get(report.matchId);
            const participant = matchDetail?.participants.find((p) => p.puuid === player.puuid);
            return (
              <div className="card" key={report.id}>
                <span className="badge">
                  {CATEGORY_ICONS[report.category]} {CATEGORY_LABELS[report.category]}
                </span>
                <p
                  style={{
                    marginTop: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    対象試合: {report.championName} ・ {queueLabel(report.queueId)} ・{" "}
                    {report.matchId}
                  </span>
                  {participant && (
                    <>
                      <span
                        className={`team-result ${participant.win ? "result-win" : "result-lose"}`}
                      >
                        {participant.win ? "勝利" : "敗北"}
                      </span>
                      <span className="kda">
                        <span className="kda-kills">{participant.kills}</span>
                        <span className="kda-sep">/</span>
                        <span className="kda-deaths">{participant.deaths}</span>
                        <span className="kda-sep">/</span>
                        <span className="kda-assists">{participant.assists}</span>
                      </span>
                    </>
                  )}
                </p>
                {matchDetail && (
                  <MatchScoreboard
                    participants={matchDetail.participants}
                    ddragonVersion={ddragonVersion}
                    highlightPuuid={player.puuid}
                  />
                )}
                {report.incidentTimestampSeconds !== null && (
                  <p style={{ marginTop: "0.5rem" }}>
                    問題のシーンの目安時間: {formatMatchTime(report.incidentTimestampSeconds)}
                  </p>
                )}
                {report.comment && (
                  <p style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>{report.comment}</p>
                )}
                {report.videoUrl && (
                  <p style={{ marginTop: "0.5rem" }}>
                    <a href={report.videoUrl} target="_blank" rel="noopener noreferrer">
                      添付された動画を見る
                    </a>
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
                <p className="muted" style={{ marginTop: "0.5rem" }}>
                  {formatDateTime(report.createdAt)}
                </p>

                {canEditReport({
                  viewerDeviceId: deviceId,
                  reportDeviceId: report.deviceId,
                  createdAt: report.createdAt,
                }) && (
                  <ReportEditForm
                    reportId={report.id}
                    initialCategory={report.category}
                    initialComment={report.comment}
                    initialIncidentSeconds={report.incidentTimestampSeconds}
                    initialVideoUrl={report.videoUrl}
                    initialImageUrl={report.imageUrl}
                  />
                )}

                <ReportVoteButtons
                  reportId={report.id}
                  initialLikeCount={report.votes.filter((v) => v.voteType === "LIKE").length}
                  initialDislikeCount={report.votes.filter((v) => v.voteType === "DISLIKE").length}
                  initialMyVote={
                    deviceId
                      ? (report.votes.find((v) => v.deviceId === deviceId)?.voteType ?? null)
                      : null
                  }
                />

                {report.moderatorReviews.length > 0 && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      paddingTop: "0.75rem",
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    {report.moderatorReviews.map((review) => (
                      <div key={review.id} style={{ marginTop: "0.5rem" }}>
                        <span className={VERDICT_BADGE_CLASS[review.verdict]}>
                          {VERDICT_ICONS[review.verdict]} {VERDICT_LABELS[review.verdict]}
                        </span>
                        <p style={{ marginTop: "0.5rem" }}>{review.rationale}</p>
                        <p className="muted" style={{ marginTop: "0.5rem" }}>
                          {review.moderator.displayName} ・ {formatDateTime(review.createdAt)}
                        </p>
                        <ReviewObjectionButton
                          reviewId={review.id}
                          initialCount={review.objections.length}
                          initialHasObjected={
                            deviceId
                              ? review.objections.some((o) => o.deviceId === deviceId)
                              : false
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
