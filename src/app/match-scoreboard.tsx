import Image from "next/image";
import Link from "next/link";
import { getChampionIconUrl } from "@/lib/ddragon";
import type { MatchParticipant } from "@/lib/riot";

function ScoreboardTeam({
  teamId,
  participants,
  ddragonVersion,
  highlightPuuid,
}: {
  teamId: number;
  participants: MatchParticipant[];
  ddragonVersion: string;
  highlightPuuid: string;
}) {
  const win = participants[0]?.win ?? false;
  const teamClass = teamId === 100 ? "team-100" : "team-200";
  const teamName = teamId === 100 ? "ブルーチーム" : "レッドチーム";

  return (
    <div className="team-block compact">
      <div className={`team-banner compact ${teamClass}`}>
        <span>{teamName}</span>
        <span className={`team-result ${win ? "result-win" : "result-lose"}`}>
          {win ? "勝利" : "敗北"}
        </span>
      </div>
      {participants.map((p) => (
        <Link
          className={`participant-row compact${p.puuid === highlightPuuid ? " highlight" : ""}`}
          href={`/players/${p.puuid}`}
          key={p.puuid}
        >
          <Image
            className={`champion-icon ${teamClass}`}
            src={getChampionIconUrl(ddragonVersion, p.championName)}
            alt={p.championName}
            width={22}
            height={22}
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
        </Link>
      ))}
    </div>
  );
}

// 通報対象の1人だけでなく試合参加者10人全員の結果を並べて出す、試合ログ用の
// コンパクトな一覧。通報フォーム(match-lookup.tsx)のチーム表示とほぼ同じ見た目だが、
// あちらは通報対象選択用のradio付きlabelで、こちらは選択操作を持たない純粋な表示用。
export function MatchScoreboard({
  participants,
  ddragonVersion,
  highlightPuuid,
}: {
  participants: MatchParticipant[];
  ddragonVersion: string;
  highlightPuuid: string;
}) {
  const blueTeam = participants.filter((p) => p.teamId === 100);
  const redTeam = participants.filter((p) => p.teamId === 200);

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <ScoreboardTeam
        teamId={100}
        participants={blueTeam}
        ddragonVersion={ddragonVersion}
        highlightPuuid={highlightPuuid}
      />
      <ScoreboardTeam
        teamId={200}
        participants={redTeam}
        ddragonVersion={ddragonVersion}
        highlightPuuid={highlightPuuid}
      />
    </div>
  );
}
