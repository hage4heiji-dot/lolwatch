import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAccountByRiotId,
  getRecentMatchIds,
  getMatchDetail,
  getLatestDdragonVersion,
  RiotApiError,
} from "@/lib/riot";
import { getClientIp } from "@/lib/ip";
import { checkSummonerMatchesRateLimit } from "@/lib/rateLimit";
import { FALLBACK_DDRAGON_VERSION } from "@/lib/ddragon";

const RECENT_MATCH_COUNT = 20;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gameName = searchParams.get("gameName")?.trim();
  const tagLine = searchParams.get("tagLine")?.trim().replace(/^#/, "");

  if (!gameName || !tagLine) {
    return NextResponse.json(
      { error: "サモナー名とタグラインの両方を入力してください。" },
      { status: 400 },
    );
  }

  const ip = getClientIp(request);
  const rateCheck = checkSummonerMatchesRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
  }

  try {
    const account = await getAccountByRiotId(gameName, tagLine);
    const matchIds = await getRecentMatchIds(account.puuid, RECENT_MATCH_COUNT);

    const [matchResults, ddragonResult] = await Promise.all([
      Promise.allSettled(matchIds.map((id) => getMatchDetail(id))),
      getLatestDdragonVersion().catch(() => FALLBACK_DDRAGON_VERSION),
    ]);

    // 個々の試合詳細取得が失敗しても(レート制限等)、取得できた分だけ返す。
    // 一覧はあくまで通報対象の試合を選ぶための入り口であり、全件表示は必須ではない。
    const matches = matchResults.flatMap((result) => {
      if (result.status !== "fulfilled") return [];
      const match = result.value;
      const self = match.participants.find((p) => p.puuid === account.puuid);
      if (!self) return [];
      return [
        {
          matchId: match.matchId,
          queueId: match.queueId,
          gameEndTimestamp: match.gameEndTimestamp,
          gameDurationSeconds: match.gameDurationSeconds,
          championName: self.championName,
          win: self.win,
          kills: self.kills,
          deaths: self.deaths,
          assists: self.assists,
          // 試合を見分けやすいよう、一覧では自分だけでなく10人分の構成も表示する。
          participants: match.participants.map((p) => ({
            puuid: p.puuid,
            championName: p.championName,
            teamId: p.teamId,
          })),
        },
      ];
    });

    return NextResponse.json({
      puuid: account.puuid,
      matches,
      ddragonVersion: ddragonResult,
    });
  } catch (err) {
    if (err instanceof RiotApiError && err.status === 404) {
      return NextResponse.json(
        { error: "指定されたサモナー名(Riot ID)が見つかりません。" },
        { status: 404 },
      );
    }
    if (err instanceof RiotApiError && err.status === 429) {
      return NextResponse.json(
        { error: "現在アクセスが集中しています。しばらくしてから再度お試しください。" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Riot APIへの問い合わせに失敗しました。" },
      { status: 502 },
    );
  }
}
