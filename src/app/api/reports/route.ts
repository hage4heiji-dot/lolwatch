import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAccountByPuuid, RiotApiError } from "@/lib/riot";
import { upsertPlayerFromRiotAccount } from "@/lib/player";
import {
  DEVICE_ID_COOKIE,
  DEVICE_ID_COOKIE_OPTIONS,
  generateDeviceId,
  readDeviceId,
} from "@/lib/deviceId";
import { getClientIp } from "@/lib/ip";
import { checkReportRateLimit } from "@/lib/rateLimit";
import { ReportCategory } from "@/generated/prisma";

// 通報は必ず特定の試合(matchId)と、その試合内の対象アカウント(puuid)に紐付ける。
// puuid/championName/queueIdは事前に GET /api/matches/[matchId] で取得した参加者一覧から選ばれたもの。
const requestSchema = z.object({
  puuid: z.string().trim().min(1).max(120),
  matchId: z.string().trim().min(1).max(60),
  championName: z.string().trim().min(1).max(60),
  queueId: z.number().int(),
  category: z.enum(ReportCategory),
  incidentTimestampSeconds: z.number().int().min(0).max(4 * 60 * 60).optional().nullable(),
  comment: z.string().trim().max(300).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容が不正です。", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { puuid, matchId, championName, queueId, category, incidentTimestampSeconds, comment } =
    parsed.data;

  const existingDeviceId = readDeviceId(request);
  const deviceId = existingDeviceId ?? generateDeviceId();
  const ip = getClientIp(request);

  function respond(body: unknown, status: number) {
    const res = NextResponse.json(body, { status });
    if (!existingDeviceId) {
      res.cookies.set(DEVICE_ID_COOKIE, deviceId, DEVICE_ID_COOKIE_OPTIONS);
    }
    return res;
  }

  // matchId選択後の確定操作。ここで最新のRiot IDを取得し直すことで改名にも追従する。
  let account;
  try {
    account = await getAccountByPuuid(puuid);
  } catch (err) {
    if (err instanceof RiotApiError && err.status === 404) {
      return respond({ error: "対象のアカウントが見つかりません。" }, 404);
    }
    if (err instanceof RiotApiError && err.status === 429) {
      return respond(
        { error: "現在アクセスが集中しています。しばらくしてから再度お試しください。" },
        503,
      );
    }
    return respond({ error: "Riot APIへの問い合わせに失敗しました。" }, 502);
  }

  const platform = process.env.RIOT_PLATFORM ?? "jp1";
  const player = await upsertPlayerFromRiotAccount(account, platform);

  const rateCheck = await checkReportRateLimit({ deviceId, ip, playerId: player.id });
  if (!rateCheck.allowed) {
    return respond({ error: rateCheck.reason }, 429);
  }

  const report = await prisma.report.create({
    data: {
      playerId: player.id,
      category,
      incidentTimestampSeconds: incidentTimestampSeconds ?? null,
      comment: comment || null,
      matchId,
      championName,
      queueId,
      deviceId,
      posterIp: ip,
    },
  });

  return respond(
    {
      ok: true,
      reportId: report.id,
      playerId: player.id,
      riotId: `${account.gameName}#${account.tagLine}`,
    },
    201,
  );
}
