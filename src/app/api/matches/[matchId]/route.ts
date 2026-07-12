import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getMatchDetail,
  getMatchTimeline,
  getLatestDdragonVersion,
  RiotApiError,
} from "@/lib/riot";
import { normalizeMatchId } from "@/lib/matchId";
import { getClientIp } from "@/lib/ip";
import { checkMatchLookupRateLimit } from "@/lib/rateLimit";
import { FALLBACK_DDRAGON_VERSION } from "@/lib/ddragon";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId: rawMatchId } = await params;
  const matchId = normalizeMatchId(rawMatchId);

  if (!matchId) {
    return NextResponse.json(
      { error: "試合IDの形式が正しくありません。" },
      { status: 400 },
    );
  }

  const ip = getClientIp(request);
  const rateCheck = checkMatchLookupRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
  }

  try {
    const match = await getMatchDetail(matchId);

    // タイムライン(キル一覧)とチャンピオンアイコン用バージョンは表示を補強する付随情報。
    // どちらか片方が取得できなくても、通報対象を選ぶという主目的は達成できるので
    // 全体を失敗させず、取得できた分だけ返す。
    const [timelineResult, ddragonResult] = await Promise.allSettled([
      getMatchTimeline(matchId),
      getLatestDdragonVersion(),
    ]);

    const kills = timelineResult.status === "fulfilled" ? timelineResult.value : [];
    const ddragonVersion =
      ddragonResult.status === "fulfilled" ? ddragonResult.value : FALLBACK_DDRAGON_VERSION;

    return NextResponse.json({ match, kills, ddragonVersion });
  } catch (err) {
    if (err instanceof RiotApiError && err.status === 404) {
      return NextResponse.json(
        { error: "指定された試合が見つかりません。" },
        { status: 404 },
      );
    }
    if (err instanceof RiotApiError && err.status === 429) {
      return NextResponse.json(
        { error: "現在アクセスが集中しています。しばらくしてから再度お試しください。" },
        { status: 503 },
      );
    }
    // カスタムゲーム等、Riot側の仕様でmatch-v5から取得できない試合は403が返る。
    if (err instanceof RiotApiError && err.status === 403) {
      return NextResponse.json(
        {
          error:
            "この試合の情報は取得できませんでした。カスタムゲームなど、Riot APIの対象外の試合の可能性があります。通常のマッチメイキングの試合IDをお試しください。",
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "Riot APIへの問い合わせに失敗しました。" },
      { status: 502 },
    );
  }
}
