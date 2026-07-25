import { prisma } from "@/lib/prisma";

// 同一投稿者(device_id or IP)からの連投を防ぐクールダウン。
const GLOBAL_COOLDOWN_MS = 60 * 1000;
// 同一対象への重複通報による水増しを防ぐクールダウン。
const PER_PLAYER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: string };

// レート制限チェックと作成処理の間には「チェック→作成」のawaitを挟むため、
// 極端に短い間隔で同一キーからのリクエストが重なると、両方がチェックを通過して
// 二重作成されてしまう可能性がある(通報の投稿・判定基準診断の受験など)。
// Node.jsはシングルスレッドで、awaitを挟まない同期区間は割り込まれないため、
// このSetへのhas/addをawaitなしで行うだけで排他制御になる。
const inFlightKeys = new Set<string>();

// 取得できればtrueを返し、以後同じキーでの取得はfalseになる。
// 呼び出し側は処理完了後(成功・失敗問わず)に必ずreleaseInFlightLockを呼ぶこと。
export function acquireInFlightLock(key: string): boolean {
  if (inFlightKeys.has(key)) return false;
  inFlightKeys.add(key);
  return true;
}

export function releaseInFlightLock(key: string): void {
  inFlightKeys.delete(key);
}

// 判定基準診断の連続受験によって平均値が水増しされるのを防ぐクールダウン。
const CALIBRATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function checkCalibrationRateLimit(params: {
  deviceId: string;
  ip: string;
}): Promise<RateLimitResult> {
  const { deviceId, ip } = params;
  const since = new Date(Date.now() - CALIBRATION_COOLDOWN_MS);
  const recent = await prisma.calibrationAttempt.findFirst({
    where: {
      OR: [{ deviceId }, { posterIp: ip }],
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  if (recent) {
    return {
      allowed: false,
      reason: "診断は24時間に1回まで受験できます。しばらくしてから再度お試しください。",
    };
  }
  return { allowed: true };
}

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

// 通報への「妥当/不当」投票API用。deviceIdクッキーは送らなければ毎回新規発行されて
// しまい重複防止(unique制約)をすり抜けられるため、クッキーに依存しないIP単位の
// 頻度制限で歯止めをかける。
const VOTE_WINDOW_MS = 60 * 1000;
const VOTE_MAX_REQUESTS = 20;
const voteHistory = new Map<string, number[]>();

export function checkVoteRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const since = now - VOTE_WINDOW_MS;
  const timestamps = (voteHistory.get(ip) ?? []).filter((t) => t >= since);

  if (timestamps.length >= VOTE_MAX_REQUESTS) {
    return {
      allowed: false,
      reason: "投票が集中しています。しばらくしてから再度お試しください。",
    };
  }

  timestamps.push(now);
  voteHistory.set(ip, timestamps);

  if (Math.random() < 0.01) {
    for (const [key, values] of voteHistory) {
      if (values.every((t) => t < since)) {
        voteHistory.delete(key);
      }
    }
  }

  return { allowed: true };
}

// モデレーター評価への異議申し立てAPI用。理由はcheckVoteRateLimitと同じ
// (deviceIdクッキーに依存しないIP単位の頻度制限)。投票より頻度が低い操作なので
// 閾値も低めにする。
const OBJECTION_WINDOW_MS = 60 * 1000;
const OBJECTION_MAX_REQUESTS = 10;
const objectionHistory = new Map<string, number[]>();

export function checkObjectionRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const since = now - OBJECTION_WINDOW_MS;
  const timestamps = (objectionHistory.get(ip) ?? []).filter((t) => t >= since);

  if (timestamps.length >= OBJECTION_MAX_REQUESTS) {
    return {
      allowed: false,
      reason: "操作が集中しています。しばらくしてから再度お試しください。",
    };
  }

  timestamps.push(now);
  objectionHistory.set(ip, timestamps);

  if (Math.random() < 0.01) {
    for (const [key, values] of objectionHistory) {
      if (values.every((t) => t < since)) {
        objectionHistory.delete(key);
      }
    }
  }

  return { allowed: true };
}

// 通報への削除申請API用。理由はcheckObjectionRateLimitと同じ
// (deviceIdクッキーに依存しないIP単位の頻度制限)。
const DELETION_REQUEST_WINDOW_MS = 60 * 1000;
const DELETION_REQUEST_MAX_REQUESTS = 10;
const deletionRequestHistory = new Map<string, number[]>();

export function checkDeletionRequestRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const since = now - DELETION_REQUEST_WINDOW_MS;
  const timestamps = (deletionRequestHistory.get(ip) ?? []).filter((t) => t >= since);

  if (timestamps.length >= DELETION_REQUEST_MAX_REQUESTS) {
    return {
      allowed: false,
      reason: "操作が集中しています。しばらくしてから再度お試しください。",
    };
  }

  timestamps.push(now);
  deletionRequestHistory.set(ip, timestamps);

  if (Math.random() < 0.01) {
    for (const [key, values] of deletionRequestHistory) {
      if (values.every((t) => t < since)) {
        deletionRequestHistory.delete(key);
      }
    }
  }

  return { allowed: true };
}

// サモナー名から直近試合一覧を検索するAPI用。1回の呼び出しで
// 試合ID一覧取得+試合詳細(最大20件)とRiot APIコストが大きいため、
// 通常の試合ID検索より低いしきい値で制限する。
const SUMMONER_MATCHES_WINDOW_MS = 60 * 1000;
const SUMMONER_MATCHES_MAX_REQUESTS = 5;
const summonerMatchesHistory = new Map<string, number[]>();

export function checkSummonerMatchesRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const since = now - SUMMONER_MATCHES_WINDOW_MS;
  const timestamps = (summonerMatchesHistory.get(ip) ?? []).filter((t) => t >= since);

  if (timestamps.length >= SUMMONER_MATCHES_MAX_REQUESTS) {
    return {
      allowed: false,
      reason: "サモナー名検索が集中しています。しばらくしてから再度お試しください。",
    };
  }

  timestamps.push(now);
  summonerMatchesHistory.set(ip, timestamps);

  if (Math.random() < 0.01) {
    for (const [key, values] of summonerMatchesHistory) {
      if (values.every((t) => t < since)) {
        summonerMatchesHistory.delete(key);
      }
    }
  }

  return { allowed: true };
}
