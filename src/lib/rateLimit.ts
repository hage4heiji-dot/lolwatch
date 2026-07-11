import { prisma } from "@/lib/prisma";

// 同一投稿者(device_id or IP)からの連投を防ぐクールダウン。
const GLOBAL_COOLDOWN_MS = 60 * 1000;
// 同一対象への重複通報による水増しを防ぐクールダウン。
const PER_PLAYER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export async function checkReportRateLimit(params: {
  deviceId: string;
  ip: string;
  playerId: string;
}): Promise<RateLimitResult> {
  const { deviceId, ip, playerId } = params;

  const globalSince = new Date(Date.now() - GLOBAL_COOLDOWN_MS);
  const recentAny = await prisma.report.findFirst({
    where: {
      OR: [{ deviceId }, { posterIp: ip }],
      createdAt: { gte: globalSince },
    },
    select: { id: true },
  });
  if (recentAny) {
    return {
      allowed: false,
      reason: "投稿間隔が短すぎます。しばらく待ってから再度お試しください。",
    };
  }

  const perPlayerSince = new Date(Date.now() - PER_PLAYER_COOLDOWN_MS);
  const recentSamePlayer = await prisma.report.findFirst({
    where: {
      playerId,
      OR: [{ deviceId }, { posterIp: ip }],
      createdAt: { gte: perPlayerSince },
    },
    select: { id: true },
  });
  if (recentSamePlayer) {
    return {
      allowed: false,
      reason: "同じ対象への通報は24時間に1回までです。",
    };
  }

  return { allowed: true };
}

// 試合検索(GET /api/matches/[matchId])用。呼び出すたびにDBへ書き込む必要がある通報とは違い
// 何も永続化しないエンドポイントなので、ここだけインメモリのスライディングウィンドウで済ませる
// (appコンテナは単一インスタンス構成: docker-compose.yml参照)。
const LOOKUP_WINDOW_MS = 60 * 1000;
const LOOKUP_MAX_REQUESTS = 20;
const lookupHistory = new Map<string, number[]>();

export function checkMatchLookupRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const since = now - LOOKUP_WINDOW_MS;
  const timestamps = (lookupHistory.get(ip) ?? []).filter((t) => t >= since);

  if (timestamps.length >= LOOKUP_MAX_REQUESTS) {
    return {
      allowed: false,
      reason: "試合検索が集中しています。しばらくしてから再度お試しください。",
    };
  }

  timestamps.push(now);
  lookupHistory.set(ip, timestamps);

  // マップが際限なく肥大化しないよう、たまに空になったキーを掃除する。
  if (Math.random() < 0.01) {
    for (const [key, values] of lookupHistory) {
      if (values.every((t) => t < since)) {
        lookupHistory.delete(key);
      }
    }
  }

  return { allowed: true };
}
