import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findPlayerByPuuid } from "@/lib/playerProfile";
import {
  getAccountByPuuid,
  getLatestDdragonVersion,
  getLeagueEntriesByPuuid,
  getMatchDetail,
  getSummonerByPuuid,
  RiotApiError,
} from "@/lib/riot";
import { FALLBACK_DDRAGON_VERSION, getRankEmblemUrl } from "@/lib/ddragon";
import {
  findFrequentTeammates,
  FrequentTeammate,
  FREQUENT_TEAMMATES_MATCH_COUNT,
} from "@/lib/frequentTeammates";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/reportCategories";
import { VERDICT_LABELS, VERDICT_BADGE_CLASS, VERDICT_ICONS } from "@/lib/moderatorVerdicts";
import { queueLabel } from "@/lib/matchQueues";
import { formatRank } from "@/lib/rankLabel";
import { formatMatchTime } from "@/lib/matchTime";
import { DEVICE_ID_COOKIE } from "@/lib/deviceId";
import { canEditReport } from "@/lib/reportEdit";
import { ReportVoteButtons } from "@/app/report-vote-buttons";
import { ReportDeletionRequestButton } from "@/app/report-deletion-request-button";
import { ReviewObjectionButton } from "@/app/review-objection-button";
import { ReportEditForm } from "@/app/report-edit-form";
import { MatchScoreboard } from "@/app/match-scoreboard";
import { ShareButtons } from "@/app/share-buttons";

const SITE_URL = "https://lol-watch.com";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ puuid: string }>;
}): Promise<Metadata> {
  const { puuid } = await params;
  const player = await prisma.player.findUnique({
    where: { puuid },
    select: { nameHistory: { where: { isCurrent: true }, take: 1 } },
  });
  const name = player?.nameHistory[0];
  const displayName = name ? `${name.riotIdName} #${name.riotIdTagLine}` : puuid;

  return {
    title: `${displayName} の通報履歴`,
    description: `${displayName} に対する通報状況とモデレーター評価の履歴です。`,
  };
}

function TeammateRankBadge({ mate }: { mate: FrequentTeammate }) {
  const tier = mate.soloRank?.tier ?? null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVGはnext/imageが標準では最適化しないため
    <img
      src={getRankEmblemUrl(tier)}
      alt={tier ?? "UNRANKED"}
      width={28}
      height={28}
      style={{ flexShrink: 0 }}
    />
  );
}

function TeammateMeta({ mate }: { mate: FrequentTeammate }) {
  return (
    <>
      {mate.soloRank ? formatRank(mate.soloRank) : "ランク情報なし"}
      {mate.summonerLevel !== null && ` ・ Lv.${mate.summonerLevel}`}
    </>
  );
}

function TeammateSummary({ mate }: { mate: FrequentTeammate }) {
  return (
    <span
      className="report-summary-match"
      style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
    >
      <TeammateRankBadge mate={mate} />
      {mate.displayName} ・ {mate.gamesTogether}試合
    </span>
  );
}

function TeammateRow({ mate }: { mate: FrequentTeammate }) {
  return (
    <div className="teammate-row">
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <TeammateRankBadge mate={mate} />
        <div>
          <Link href={`/players/${mate.puuid}`}>{mate.displayName}</Link>
          <p className="muted" style={{ fontSize: "0.75rem" }}>
            <TeammateMeta mate={mate} />
          </p>
        </div>
      </div>
      <span className="muted">{mate.gamesTogether}試合共にプレイ</span>
    </div>
  );
}

export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ puuid: string }>;
  searchParams: Promise<{ report?: string }>;
}) {
  const { puuid } = await params;
  const { report: highlightedReportId } = await searchParams;
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
      </div>
    );
  }

  const currentName = player.nameHistory.find((n) => n.isCurrent);
  const pastNames = player.nameHistory.filter((n) => !n.isCurrent);
  const latestRankCheck = player.rankActivity[0];

  // ランクや試合結果、一緒にプレイした相手はいずれもRiot APIの補助情報。
  // 取得に失敗しても通報一覧自体は表示できるよう、個別にcatchしてページ全体を
  // 落とさない(api/matches/[matchId]と同じ方針)。
  const uniqueMatchIds = [...new Set(player.reports.map((r) => r.matchId))];
  const [summoner, leagueEntries, matchDetailResults, ddragonVersion, frequentTeammates] =
    await Promise.all([
      getSummonerByPuuid(player.puuid, player.platform).catch(() => null),
      getLeagueEntriesByPuuid(player.puuid, player.platform).catch(() => []),
      Promise.allSettled(uniqueMatchIds.map(getMatchDetail)),
      getLatestDdragonVersion().catch(() => FALLBACK_DDRAGON_VERSION),
      findFrequentTeammates(player.puuid, player.platform),
    ]);
  const matchDetailByMatchId = new Map<string, Awaited<ReturnType<typeof getMatchDetail>>>();
  matchDetailResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      matchDetailByMatchId.set(uniqueMatchIds[i], result.value);
    }
  });
  const soloRank = leagueEntries.find((entry) => entry.queueType === "RANKED_SOLO_5x5") ?? null;
  const [topTeammate, ...restTeammates] = frequentTeammates;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", flexWrap: "wrap" }}>
        <h1>
          {currentName
            ? `${currentName.riotIdName} #${currentName.riotIdTagLine}`
            : "(表示名不明)"}
        </h1>
        {summoner && <span className="badge">Lv.{summoner.summonerLevel}</span>}
      </div>

      <div style={{ marginTop: "0.75rem" }}>
        <ShareButtons
          url={`${SITE_URL}/players/${player.puuid}`}
          text={`${
            currentName ? `${currentName.riotIdName} #${currentName.riotIdTagLine}` : "プレイヤー"
          }の通報履歴 | lolwatch`}
        />
      </div>

      {pastNames.length > 0 && (
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          過去の名前:{" "}
          {pastNames
            .map((n) => `${n.riotIdName} #${n.riotIdTagLine}`)
            .join(", ")}
        </p>
      )}

      <div className="rank-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVGはnext/imageが標準では最適化しないため */}
        <img
          src={getRankEmblemUrl(soloRank?.tier ?? null)}
          alt={soloRank?.tier ?? "UNRANKED"}
          width={64}
          height={64}
          style={{ flexShrink: 0 }}
        />
        {soloRank ? (
          <div>
            <p className="rank-card-tier">{formatRank(soloRank)}</p>
            <p className="muted">
              ソロ/デュオ ・ {soloRank.wins}勝{soloRank.losses}敗
              {soloRank.wins + soloRank.losses > 0 &&
                ` (勝率${Math.round((soloRank.wins / (soloRank.wins + soloRank.losses)) * 100)}%)`}
            </p>
          </div>
        ) : (
          <div>
            <p className="rank-card-tier">ランクなし</p>
            <p className="muted">ソロ/デュオの情報がありません(未ランクの可能性)。</p>
          </div>
        )}
      </div>

      {latestRankCheck && (
        <p
          className="muted"
          style={{
            marginTop: "0.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <span className={latestRankCheck.isActiveInRanked ? "badge badge-verified-guilty" : "badge"}>
            {latestRankCheck.isActiveInRanked
              ? "⚠️ 通報後もランク参加中の可能性"
              : "✅ 直近のランク参加は確認できず"}
          </span>
          <span>最終確認: {formatDateTime(latestRankCheck.checkedAt)}</span>
        </p>
      )}

      <section className="section">
        <h2>
          試合ごとの通報{" "}
          <span className="badge badge-unverified">通報自体は未検証</span>
        </h2>
        <p className="muted" style={{ marginBottom: "0.75rem" }}>
          「モデレーター評価」が付いている試合は、運営が実際にリプレイ等を確認した上での判定です。付いていない試合は一般ユーザーからの未検証の通報のみです。行をクリックすると詳細が開きます。
        </p>
        {player.reports.length === 0 ? (
          <p className="muted">まだ通報はありません。</p>
        ) : (
          player.reports.map((report) => {
            const matchDetail = matchDetailByMatchId.get(report.matchId);
            const participant = matchDetail?.participants.find((p) => p.puuid === player.puuid);
            const latestReview = report.moderatorReviews[0];
            const isHighlighted = report.id === highlightedReportId;
            return (
              <details
                className={`card report-card${isHighlighted ? " report-card-highlighted" : ""}`}
                key={report.id}
                id={`report-${report.id}`}
                open={isHighlighted || undefined}
              >
                <summary className="report-summary">
                  <span className="badge">
                    {CATEGORY_ICONS[report.category]} {CATEGORY_LABELS[report.category]}
                  </span>
                  <span className="report-summary-match">
                    {report.championName} ・ {queueLabel(report.queueId)}
                  </span>
                  {latestReview && (
                    <span className={VERDICT_BADGE_CLASS[latestReview.verdict]}>
                      {VERDICT_ICONS[latestReview.verdict]} {VERDICT_LABELS[latestReview.verdict]}
                    </span>
                  )}
                  <span className="muted report-summary-date">
                    {formatDateTime(report.createdAt)}
                  </span>
                  <span className="report-summary-toggle" aria-hidden="true">
                    <span className="report-summary-toggle-closed">詳細を見る ▾</span>
                    <span className="report-summary-toggle-open">閉じる ▴</span>
                  </span>
                </summary>

                <div className="report-detail">
                  <p
                    style={{
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
                  {report.referenceUrl && (
                    <p style={{ marginTop: "0.5rem" }}>
                      <a href={report.referenceUrl} target="_blank" rel="noopener noreferrer">
                        添付された参考URLを見る
                      </a>
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
                      initialReferenceUrl={report.referenceUrl}
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

                  <ReportDeletionRequestButton
                    reportId={report.id}
                    initialCount={report.deletionRequests.length}
                    initialHasRequested={
                      deviceId
                        ? report.deletionRequests.some((d) => d.deviceId === deviceId)
                        : false
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
                          <p style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>{review.rationale}</p>
                          <p className="muted" style={{ marginTop: "0.5rem" }}>
                            ⚔️ {review.moderator.displayName} ・ {formatDateTime(review.createdAt)}
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
              </details>
            );
          })
        )}
      </section>

      <section className="section">
        <h2>👥 直近一緒にプレイしていたユーザー</h2>
        <p className="muted" style={{ marginBottom: "0.75rem" }}>
          直近{FREQUENT_TEAMMATES_MATCH_COUNT}試合のうち、2試合以上同じチームだった相手をRiot
          APIから自動検出したものです。この一覧に載ること自体は通報や違反を意味しません。
        </p>
        {!topTeammate ? (
          <p className="muted">該当する相手はいませんでした。</p>
        ) : (
          <details className="card report-card">
            <summary className="report-summary">
              <TeammateSummary mate={topTeammate} />
              {restTeammates.length > 0 && (
                <span className="muted report-summary-date">他{restTeammates.length}人</span>
              )}
              <span className="report-summary-toggle" aria-hidden="true">
                <span className="report-summary-toggle-closed">一覧を見る ▾</span>
                <span className="report-summary-toggle-open">閉じる ▴</span>
              </span>
            </summary>
            <div className="report-detail">
              {frequentTeammates.map((mate) => (
                <TeammateRow mate={mate} key={mate.puuid} />
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
