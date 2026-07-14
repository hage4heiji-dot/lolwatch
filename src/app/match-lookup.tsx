"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CATEGORY_LABELS } from "@/lib/reportCategories";
import { queueLabel } from "@/lib/matchQueues";
import { getChampionIconUrl } from "@/lib/ddragon";
import { formatMatchTime, parseMatchTime } from "@/lib/matchTime";
import { isSafeReferenceUrl } from "@/lib/referenceUrl";
import { KillTimeline } from "./kill-timeline";
import type { MatchDetail, MatchKillEvent, MatchParticipant } from "@/lib/riot";

// DDragon側に存在しないチャンピオン名(表記揺れの取りこぼしや今後の新規チャンピオン反映漏れ等)
// が来ても壊れた画像アイコンを表示しないよう、読み込み失敗時はプレースホルダーに切り替える。
function ChampionIcon({
  ddragonVersion,
  championName,
  size,
  className = "",
}: {
  ddragonVersion: string;
  championName: string;
  size: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`champion-icon champion-icon-fallback ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        title={championName}
      >
        ?
      </span>
    );
  }

  return (
    <Image
      className={`champion-icon ${className}`}
      src={getChampionIconUrl(ddragonVersion, championName)}
      alt={championName}
      width={size}
      height={size}
      onError={() => setFailed(true)}
    />
  );
}

function TeamSection({
  teamId,
  participants,
  selectedPuuid,
  onSelect,
  ddragonVersion,
}: {
  teamId: number;
  participants: MatchParticipant[];
  selectedPuuid: string;
  onSelect: (puuid: string) => void;
  ddragonVersion: string;
}) {
  const win = participants[0]?.win ?? false;
  const teamClass = teamId === 100 ? "team-100" : "team-200";
  const teamName = teamId === 100 ? "ブルーチーム" : "レッドチーム";

  return (
    <div className="team-block">
      <div className={`team-banner ${teamClass}`}>
        <span>{teamName}</span>
        <span className={`team-result ${win ? "result-win" : "result-lose"}`}>
          {win ? "勝利" : "敗北"}
        </span>
      </div>
      {participants.map((p) => (
        <div className="participant-row" key={p.puuid}>
          <label className="participant-label">
            <input
              type="radio"
              name="target"
              value={p.puuid}
              checked={selectedPuuid === p.puuid}
              onChange={() => onSelect(p.puuid)}
            />
            <ChampionIcon
              ddragonVersion={ddragonVersion}
              championName={p.championName}
              size={40}
              className={teamClass}
            />
            <span className="participant-name">
              <span className="riot-id">
                {p.riotIdGameName} <span className="muted">#{p.riotIdTagLine}</span>
              </span>
              <span className="champion-name">{p.championName}</span>
            </span>
            <span className="kda">
              <span className="kda-kills">{p.kills}</span>
              <span className="kda-sep">/</span>
              <span className="kda-deaths">{p.deaths}</span>
              <span className="kda-sep">/</span>
              <span className="kda-assists">{p.assists}</span>
            </span>
          </label>
          <Link
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.3rem 0.55rem", flexShrink: 0 }}
            href={`/players/${p.puuid}`}
            target="_blank"
          >
            プロフィール
          </Link>
        </div>
      ))}
    </div>
  );
}

interface SummonerMatchParticipant {
  puuid: string;
  championName: string;
  teamId: number;
}

interface SummonerMatchSummary {
  matchId: string;
  queueId: number;
  gameEndTimestamp: number;
  gameDurationSeconds: number;
  championName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  participants: SummonerMatchParticipant[];
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function MatchLookup() {
  const router = useRouter();
  const [lookupMode, setLookupMode] = useState<"matchId" | "summoner">("matchId");
  const [matchIdInput, setMatchIdInput] = useState("");
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [kills, setKills] = useState<MatchKillEvent[]>([]);
  const [ddragonVersion, setDdragonVersion] = useState<string | null>(null);
  const [selectedPuuid, setSelectedPuuid] = useState("");
  const [category, setCategory] = useState("");
  const [incidentTimeInput, setIncidentTimeInput] = useState("");
  const [incidentSeconds, setIncidentSeconds] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);

  const [gameNameInput, setGameNameInput] = useState("");
  const [tagLineInput, setTagLineInput] = useState("");
  const [summonerMatches, setSummonerMatches] = useState<SummonerMatchSummary[] | null>(null);
  const [summonerDdragonVersion, setSummonerDdragonVersion] = useState<string | null>(null);
  const [summonerLookupPending, setSummonerLookupPending] = useState(false);
  const [summonerPuuid, setSummonerPuuid] = useState<string | null>(null);

  async function loadMatch(id: string) {
    setError(null);
    setLookupPending(true);
    try {
      const res = await fetch(`/api/matches/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "試合情報の取得に失敗しました。");
        return;
      }
      setMatch(data.match);
      setKills(data.kills ?? []);
      setDdragonVersion(data.ddragonVersion ?? null);
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setLookupPending(false);
    }
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!matchIdInput.trim()) {
      setError("試合IDを入力してください。");
      return;
    }
    await loadMatch(matchIdInput.trim());
  }

  async function handleSummonerSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!gameNameInput.trim() || !tagLineInput.trim()) {
      setError("サモナー名とタグラインの両方を入力してください。");
      return;
    }
    setSummonerLookupPending(true);
    setSummonerMatches(null);
    try {
      const params = new URLSearchParams({
        gameName: gameNameInput.trim(),
        tagLine: tagLineInput.trim().replace(/^#/, ""),
      });
      const res = await fetch(`/api/summoners/matches?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "試合履歴の取得に失敗しました。");
        return;
      }
      setSummonerMatches(data.matches ?? []);
      setSummonerDdragonVersion(data.ddragonVersion ?? null);
      setSummonerPuuid(data.puuid ?? null);
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSummonerLookupPending(false);
    }
  }

  function handleIncidentTimeInputChange(value: string) {
    setIncidentTimeInput(value);
    setIncidentSeconds(value.trim() ? parseMatchTime(value) : null);
  }

  function handleTimelineChange(seconds: number) {
    setIncidentSeconds(seconds);
    setIncidentTimeInput(formatMatchTime(seconds));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!match) return;

    const participant = match.participants.find((p) => p.puuid === selectedPuuid);
    if (!participant) {
      setError("通報するアカウントを選択してください。");
      return;
    }
    if (!category) {
      setError("通報の種別を選択してください。");
      return;
    }
    if (incidentTimeInput.trim() && incidentSeconds === null) {
      setError("目安時間の形式が正しくありません(例: 12:34)。");
      return;
    }
    if (referenceUrl.trim() && !isSafeReferenceUrl(referenceUrl.trim())) {
      setError("参考URLの形式が正しくありません(http/httpsのURLを入力してください)。");
      return;
    }

    setSubmitPending(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puuid: selectedPuuid,
          matchId: match.matchId,
          championName: participant.championName,
          queueId: match.queueId,
          category,
          incidentTimestampSeconds: incidentSeconds ?? undefined,
          comment: comment.trim() || undefined,
          referenceUrl: referenceUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "通報の送信に失敗しました。");
        return;
      }
      router.push(`/players/${selectedPuuid}`);
      router.refresh();
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSubmitPending(false);
    }
  }

  if (!match) {
    return (
      <div>
        <div className="lookup-mode-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={lookupMode === "matchId"}
            className={lookupMode === "matchId" ? "active" : ""}
            onClick={() => {
              setLookupMode("matchId");
              setError(null);
            }}
          >
            試合IDで検索
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={lookupMode === "summoner"}
            className={lookupMode === "summoner" ? "active" : ""}
            onClick={() => {
              setLookupMode("summoner");
              setError(null);
            }}
          >
            サモナー名で直近20戦から選ぶ
          </button>
        </div>

        {lookupMode === "matchId" ? (
          <form onSubmit={handleLookup}>
            <div className="form-field">
              <label htmlFor="matchId">試合ID(Match ID)</label>
              <input
                id="matchId"
                placeholder="例: JP1_123456789 または 123456789"
                autoComplete="off"
                value={matchIdInput}
                onChange={(e) => setMatchIdInput(e.target.value)}
                required
              />
            </div>
            <button className="btn" type="submit" disabled={lookupPending}>
              {lookupPending ? "検索中…" : "試合を検索"}
            </button>
          </form>
        ) : (
          <div>
            <form onSubmit={handleSummonerSearch}>
              <div className="form-field">
                <label htmlFor="gameName">サモナー名(Riot ID)</label>
                <div className="form-row">
                  <div className="form-field" style={{ flex: 2 }}>
                    <input
                      id="gameName"
                      placeholder="例: Faker#JP1(ゲーム内コピーの貼り付け可)"
                      autoComplete="off"
                      value={gameNameInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        const hashIndex = value.indexOf("#");
                        if (hashIndex !== -1) {
                          setGameNameInput(value.slice(0, hashIndex));
                          setTagLineInput(value.slice(hashIndex + 1));
                        } else {
                          setGameNameInput(value);
                        }
                      }}
                      required
                    />
                  </div>
                  <div className="form-field" style={{ flex: 1 }}>
                    <input
                      id="tagLine"
                      placeholder="タグ(例: JP1)"
                      autoComplete="off"
                      value={tagLineInput}
                      onChange={(e) => setTagLineInput(e.target.value.replace(/^#/, ""))}
                      required
                    />
                  </div>
                </div>
              </div>
              <button className="btn" type="submit" disabled={summonerLookupPending}>
                {summonerLookupPending ? "検索中…" : "直近20戦を検索"}
              </button>
            </form>

            {summonerMatches && (
              <div className="form-field">
                <label>試合を選択(通報したい試合をクリック)</label>
                {summonerMatches.length === 0 ? (
                  <p className="muted">直近の試合が見つかりませんでした。</p>
                ) : (
                  <div className="team-block">
                    {summonerMatches.map((m) => {
                      const blueTeam = m.participants.filter((p) => p.teamId === 100);
                      const redTeam = m.participants.filter((p) => p.teamId === 200);
                      return (
                        <button
                          type="button"
                          key={m.matchId}
                          className="summoner-match-row"
                          onClick={() => loadMatch(m.matchId)}
                          disabled={lookupPending}
                        >
                          {summonerDdragonVersion && (
                            <div className="summoner-match-comp">
                              <div className="summoner-match-team">
                                {blueTeam.map((p) => (
                                  <ChampionIcon
                                    key={p.puuid}
                                    ddragonVersion={summonerDdragonVersion}
                                    championName={p.championName}
                                    size={22}
                                    className={`team-100${p.puuid === summonerPuuid ? " self" : ""}`}
                                  />
                                ))}
                              </div>
                              <div className="summoner-match-team">
                                {redTeam.map((p) => (
                                  <ChampionIcon
                                    key={p.puuid}
                                    ddragonVersion={summonerDdragonVersion}
                                    championName={p.championName}
                                    size={22}
                                    className={`team-200${p.puuid === summonerPuuid ? " self" : ""}`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          <span className="summoner-match-info">
                            <span className={`team-result ${m.win ? "result-win" : "result-lose"}`}>
                              {m.win ? "勝利" : "敗北"}
                            </span>
                            <span className="queue-name">{queueLabel(m.queueId)}</span>
                            <span className="muted">
                              {formatDateTime(new Date(m.gameEndTimestamp))}
                            </span>
                          </span>
                          <span className="kda">
                            <span className="kda-kills">{m.kills}</span>
                            <span className="kda-sep">/</span>
                            <span className="kda-deaths">{m.deaths}</span>
                            <span className="kda-sep">/</span>
                            <span className="kda-assists">{m.assists}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>
    );
  }

  const blueTeam = match.participants.filter((p) => p.teamId === 100);
  const redTeam = match.participants.filter((p) => p.teamId === 200);

  return (
    <form onSubmit={handleSubmit}>
      <div className="match-summary-header">
        <span className="queue-name">{queueLabel(match.queueId)}</span>
        <span className="muted">
          {match.matchId} ・ 試合時間 {formatMatchTime(match.gameDurationSeconds)}
        </span>
      </div>

      <div className="form-field">
        <label>参加者(プロフィール閲覧、または通報するアカウントを選択)</label>
        {ddragonVersion && (
          <>
            <TeamSection
              teamId={100}
              participants={blueTeam}
              selectedPuuid={selectedPuuid}
              onSelect={setSelectedPuuid}
              ddragonVersion={ddragonVersion}
            />
            <TeamSection
              teamId={200}
              participants={redTeam}
              selectedPuuid={selectedPuuid}
              onSelect={setSelectedPuuid}
              ddragonVersion={ddragonVersion}
            />
          </>
        )}
      </div>

      <div className="form-field">
        <label>キルタイミング(アイコンにカーソルを合わせると誰が誰を倒したか表示されます。クリックで下の目安時間に反映)</label>
        {ddragonVersion && (
          <KillTimeline
            kills={kills}
            participants={match.participants}
            gameDurationSeconds={match.gameDurationSeconds}
            ddragonVersion={ddragonVersion}
            valueSeconds={incidentSeconds}
            onChangeSeconds={handleTimelineChange}
          />
        )}
      </div>

      <div className="form-field">
        <label htmlFor="category">通報の種別</label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        >
          <option value="" disabled>
            選択してください
          </option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="comment">コメント(任意 / 300字まで)</label>
        <textarea
          id="comment"
          rows={3}
          maxLength={300}
          placeholder="どのような行為だったか具体的に(個人が特定できる情報は書かないでください)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <span className="muted">{comment.length}/300字</span>
      </div>

      <div className="form-field">
        <label htmlFor="incidentTime">問題のシーンの目安時間(任意 / 例: 12:34)</label>
        <input
          id="incidentTime"
          placeholder="12:34"
          autoComplete="off"
          value={incidentTimeInput}
          onChange={(e) => handleIncidentTimeInputChange(e.target.value)}
        />
        <span className="muted">特定できない場合は空欄のままで構いません。</span>
      </div>

      <div className="form-field">
        <label htmlFor="referenceUrl">参考URL(任意)</label>
        <input
          id="referenceUrl"
          type="url"
          placeholder="例: Xの投稿、YouTubeの動画URL、imgur.comの画像URL等"
          autoComplete="off"
          value={referenceUrl}
          onChange={(e) => setReferenceUrl(e.target.value)}
        />
        <span className="muted">
          リプレイにはチャットログ等が残らないため、証跡となるURL(X投稿・動画・画像等)があれば添付してください。
        </span>
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="btn" type="submit" disabled={submitPending}>
          {submitPending ? "送信中…" : "選択したアカウントを通報する"}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            setMatch(null);
            setKills([]);
            setDdragonVersion(null);
            setSelectedPuuid("");
            setIncidentTimeInput("");
            setIncidentSeconds(null);
            setComment("");
            setReferenceUrl("");
            setSummonerMatches(null);
          }}
        >
          別の試合を選び直す
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
