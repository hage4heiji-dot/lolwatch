import { getMatchDetail, getRecentMatchIds } from "@/lib/riot";

export const FREQUENT_TEAMMATES_MATCH_COUNT = 20;
export const FREQUENT_TEAMMATES_MIN_GAMES = 2;

export interface FrequentTeammate {
  puuid: string;
  displayName: string;
  gamesTogether: number;
}

// 直近試合から、同じチームで2試合以上一緒だった相手を検出する。
// 通報された本人だけでなく、よく一緒にプレイしている相手も可視化することで
// 抑止効果を狙うプレイヤーページの基本情報欄。Riot APIの失敗は致命的にせず、
// 取得できた範囲だけで集計する(通報一覧のmatchDetail取得と同じ方針)。
export async function findFrequentTeammates(puuid: string): Promise<FrequentTeammate[]> {
  let matchIds: string[];
  try {
    matchIds = await getRecentMatchIds(puuid, FREQUENT_TEAMMATES_MATCH_COUNT);
  } catch {
    return [];
  }
  if (matchIds.length === 0) return [];

  const matchResults = await Promise.allSettled(matchIds.map((id) => getMatchDetail(id)));

  const tally = new Map<string, { displayName: string; count: number }>();
  for (const result of matchResults) {
    if (result.status !== "fulfilled") continue;
    const match = result.value;
    const target = match.participants.find((p) => p.puuid === puuid);
    if (!target) continue;

    for (const participant of match.participants) {
      if (participant.puuid === puuid || participant.teamId !== target.teamId) continue;
      const displayName = `${participant.riotIdGameName} #${participant.riotIdTagLine}`;
      const existing = tally.get(participant.puuid);
      if (existing) {
        existing.count += 1;
        existing.displayName = displayName;
      } else {
        tally.set(participant.puuid, { displayName, count: 1 });
      }
    }
  }

  return Array.from(tally.entries())
    .filter(([, v]) => v.count >= FREQUENT_TEAMMATES_MIN_GAMES)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([teammatePuuid, v]) => ({
      puuid: teammatePuuid,
      displayName: v.displayName,
      gamesTogether: v.count,
    }));
}
