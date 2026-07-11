"use client";

import Image from "next/image";
import type { MatchKillEvent, MatchParticipant } from "@/lib/riot";
import { formatMatchTime } from "@/lib/matchTime";
import { getChampionIconUrl } from "@/lib/ddragon";

const LANE_COUNT = 3;
const LANE_HEIGHT_PX = 42;
// 時間軸上でこの割合(%)未満しか離れていないキルは重なるとみなし、別レーンにずらす。
const LANE_GAP_PERCENT = 7;

function assignLanes(sortedKills: MatchKillEvent[], gameDurationSeconds: number): number[] {
  const lastPercentByLane = new Array<number>(LANE_COUNT).fill(-Infinity);
  const lanes: number[] = [];

  for (const kill of sortedKills) {
    const percent =
      gameDurationSeconds > 0 ? (kill.timestampSeconds / gameDurationSeconds) * 100 : 0;

    let chosenLane = lastPercentByLane.indexOf(Math.min(...lastPercentByLane));
    for (let i = 0; i < LANE_COUNT; i++) {
      if (percent - lastPercentByLane[i] >= LANE_GAP_PERCENT) {
        chosenLane = i;
        break;
      }
    }

    lastPercentByLane[chosenLane] = percent;
    lanes.push(chosenLane);
  }

  return lanes;
}

export function KillTimeline({
  kills,
  participants,
  gameDurationSeconds,
  ddragonVersion,
  valueSeconds,
  onChangeSeconds,
}: {
  kills: MatchKillEvent[];
  participants: MatchParticipant[];
  gameDurationSeconds: number;
  ddragonVersion: string;
  valueSeconds: number | null;
  onChangeSeconds: (seconds: number) => void;
}) {
  const byParticipantId = new Map(participants.map((p) => [p.participantId, p]));
  const sortedKills = [...kills].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  const lanes = assignLanes(sortedKills, gameDurationSeconds);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (gameDurationSeconds <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onChangeSeconds(Math.round(ratio * gameDurationSeconds));
  }

  return (
    <div>
      <div className="kill-timeline-legend muted">
        <span>
          <span className="legend-dot team-100" />
          ブルーチームのキル
        </span>
        <span>
          <span className="legend-dot team-200" />
          レッドチームのキル
        </span>
      </div>

      <div
        className="kill-timeline"
        style={{ height: `${24 + LANE_COUNT * LANE_HEIGHT_PX}px` }}
        onClick={handleClick}
      >
        <div className="kill-timeline-baseline" />
        {gameDurationSeconds > 0 &&
          sortedKills.map((kill, i) => {
            const killer = byParticipantId.get(kill.killerParticipantId);
            const victim = byParticipantId.get(kill.victimParticipantId);
            const teamClass =
              killer?.teamId === 100
                ? "team-100"
                : killer?.teamId === 200
                  ? "team-200"
                  : "team-unknown";
            const left = `${(kill.timestampSeconds / gameDurationSeconds) * 100}%`;
            const killerLabel = killer
              ? `${killer.riotIdGameName}(${killer.championName})`
              : "タワー/モンスター";
            const victimLabel = victim
              ? `${victim.riotIdGameName}(${victim.championName})`
              : "不明";

            return (
              <div
                className="kill-event"
                key={i}
                style={{ left, top: `${4 + lanes[i] * LANE_HEIGHT_PX}px` }}
                title={`${formatMatchTime(kill.timestampSeconds)} ${killerLabel} → ${victimLabel} を撃破`}
              >
                <div className={`kill-event-icons ${teamClass}`}>
                  {killer ? (
                    <Image
                      className="kill-event-icon"
                      src={getChampionIconUrl(ddragonVersion, killer.championName)}
                      alt={killerLabel}
                      width={18}
                      height={18}
                    />
                  ) : (
                    <span className="kill-event-icon" aria-hidden>
                      🗼
                    </span>
                  )}
                  <span className="kill-event-arrow">→</span>
                  {victim && (
                    <Image
                      className="kill-event-icon kill-event-icon-victim"
                      src={getChampionIconUrl(ddragonVersion, victim.championName)}
                      alt={victimLabel}
                      width={13}
                      height={13}
                    />
                  )}
                </div>
                <span className="kill-event-time muted">{formatMatchTime(kill.timestampSeconds)}</span>
              </div>
            );
          })}
        {valueSeconds !== null && gameDurationSeconds > 0 && (
          <div
            className="kill-timeline-marker"
            style={{ left: `${(valueSeconds / gameDurationSeconds) * 100}%` }}
          />
        )}
      </div>
      <div className="kill-timeline-labels muted">
        <span>0:00</span>
        <span>{formatMatchTime(gameDurationSeconds)}</span>
      </div>
    </div>
  );
}
