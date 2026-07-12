import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionModerator } from "@/lib/moderatorAuth";
import { buildReplayLaunchScript, scriptFileName } from "@/lib/replayScript";
import { formatMatchTime } from "@/lib/matchTime";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const moderator = await getSessionModerator();
  if (!moderator) {
    return NextResponse.json({ error: "モデレーターログインが必要です。" }, { status: 401 });
  }

  const { matchId } = await params;
  const match = /^[A-Z0-9]+_(\d+)$/.exec(matchId.toUpperCase());
  if (!match) {
    return NextResponse.json({ error: "試合IDの形式が正しくありません。" }, { status: 400 });
  }
  const gameId = match[1];

  const incidentParam = request.nextUrl.searchParams.get("t");
  const incidentSeconds = incidentParam ? Number(incidentParam) : null;
  const incidentTimeLabel =
    incidentSeconds !== null && Number.isFinite(incidentSeconds) && incidentSeconds >= 0
      ? formatMatchTime(incidentSeconds)
      : null;

  const script = buildReplayLaunchScript({ gameId, matchId, incidentTimeLabel });

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${scriptFileName(matchId)}"`,
    },
  });
}
