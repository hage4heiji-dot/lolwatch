const RIOT_API_KEY = process.env.RIOT_API_KEY;
const RIOT_REGION = process.env.RIOT_REGION ?? "asia";

export class RiotApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export async function getAccountByRiotId(
  gameName: string,
  tagLine: string,
): Promise<RiotAccount> {
  if (!RIOT_API_KEY) {
    throw new Error("RIOT_API_KEY is not configured");
  }

  const url = `https://${RIOT_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;

  const res = await fetch(url, {
    headers: { "X-Riot-Token": RIOT_API_KEY },
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new RiotApiError("Riot ID not found", 404);
  }
  if (res.status === 429) {
    throw new RiotApiError("Riot API rate limit exceeded", 429);
  }
  if (!res.ok) {
    throw new RiotApiError(`Riot API error: ${res.status}`, res.status);
  }

  const data = (await res.json()) as RiotAccount;
  return data;
}

// 直近sinceにランクマッチ(ソロ/フレックス双方を含むtype=ranked)に出場しているかどうかの確認。
// 存在有無だけ分かればよいのでcount=1に絞ってペイロード・レート制限消費を最小化する。
export async function hasRecentRankedMatch(
  puuid: string,
  since: Date,
): Promise<boolean> {
  if (!RIOT_API_KEY) {
    throw new Error("RIOT_API_KEY is not configured");
  }

  const startTime = Math.floor(since.getTime() / 1000);
  const url = `https://${RIOT_REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?type=ranked&startTime=${startTime}&start=0&count=1`;

  const res = await fetch(url, {
    headers: { "X-Riot-Token": RIOT_API_KEY },
    cache: "no-store",
  });

  if (res.status === 404) {
    return false;
  }
  if (res.status === 429) {
    throw new RiotApiError("Riot API rate limit exceeded", 429);
  }
  if (!res.ok) {
    throw new RiotApiError(`Riot API error: ${res.status}`, res.status);
  }

  const matchIds = (await res.json()) as string[];
  return matchIds.length > 0;
}

export interface MatchParticipant {
  participantId: number;
  puuid: string;
  riotIdGameName: string;
  riotIdTagLine: string;
  championName: string;
  teamId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
}

export interface MatchDetail {
  matchId: string;
  queueId: number;
  gameEndTimestamp: number;
  gameDurationSeconds: number;
  participants: MatchParticipant[];
}

// LoLクライアント上でユーザー自身が特定できる試合ID(matchId)から、
// その試合の参加者一覧(10人)を1回のAPI呼び出しで取得する。
// 通報対象のアカウントはこの一覧から選ばせる(APIコストを抑えるため試合検索は行わない)。
export async function getMatchDetail(matchId: string): Promise<MatchDetail> {
  if (!RIOT_API_KEY) {
    throw new Error("RIOT_API_KEY is not configured");
  }

  const url = `https://${RIOT_REGION}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;

  const res = await fetch(url, {
    headers: { "X-Riot-Token": RIOT_API_KEY },
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new RiotApiError("Match not found", 404);
  }
  if (res.status === 429) {
    throw new RiotApiError("Riot API rate limit exceeded", 429);
  }
  if (!res.ok) {
    throw new RiotApiError(`Riot API error: ${res.status}`, res.status);
  }

  const data = (await res.json()) as {
    info: {
      queueId: number;
      gameEndTimestamp: number;
      gameDuration: number;
      // Riot APIの実際のフィールド名は riotIdTagline (l が小文字)。
      // 他のRiot ID関連APIの tagLine 表記に合わせてこちら側の型ではキャメルケースに正規化する。
      participants: {
        participantId: number;
        puuid: string;
        riotIdGameName: string;
        riotIdTagline: string;
        championName: string;
        teamId: number;
        win: boolean;
        kills: number;
        deaths: number;
        assists: number;
      }[];
    };
  };

  return {
    matchId,
    queueId: data.info.queueId,
    gameEndTimestamp: data.info.gameEndTimestamp,
    // gameDurationは旧いバッチでは秒未満の値がミリ秒で入ることがあるため、
    // ゲーム終了時刻との差分から実際の秒数を推定する(明らかに大きすぎる場合のみ)。
    gameDurationSeconds:
      data.info.gameDuration > 10 * 60 * 60
        ? Math.round(data.info.gameDuration / 1000)
        : data.info.gameDuration,
    participants: data.info.participants.map((p) => ({
      participantId: p.participantId,
      puuid: p.puuid,
      riotIdGameName: p.riotIdGameName,
      riotIdTagLine: p.riotIdTagline,
      championName: p.championName,
      teamId: p.teamId,
      win: p.win,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
    })),
  };
}

// 直近試合ID一覧(ゲームモード問わず)。「一緒にプレイした人」の検出に使う。
export async function getRecentMatchIds(puuid: string, count = 20): Promise<string[]> {
  if (!RIOT_API_KEY) {
    throw new Error("RIOT_API_KEY is not configured");
  }

  const url = `https://${RIOT_REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${count}`;

  const res = await fetch(url, {
    headers: { "X-Riot-Token": RIOT_API_KEY },
    cache: "no-store",
  });

  if (res.status === 404) {
    return [];
  }
  if (res.status === 429) {
    throw new RiotApiError("Riot API rate limit exceeded", 429);
  }
  if (!res.ok) {
    throw new RiotApiError(`Riot API error: ${res.status}`, res.status);
  }

  return (await res.json()) as string[];
}

export interface MatchKillEvent {
  timestampSeconds: number;
  // 0 はタワー/モンスター等、プレイヤー以外によるキル(processed as environmental)。
  killerParticipantId: number;
  victimParticipantId: number;
  assistingParticipantIds: number[];
}

// キルタイミングの線表表示用。試合詳細とは別APIなので、通報対象を選ぶ前の
// 検索1回につき追加でもう1回Riot APIを呼び出すことになる点に注意。
export async function getMatchTimeline(matchId: string): Promise<MatchKillEvent[]> {
  if (!RIOT_API_KEY) {
    throw new Error("RIOT_API_KEY is not configured");
  }

  const url = `https://${RIOT_REGION}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`;

  const res = await fetch(url, {
    headers: { "X-Riot-Token": RIOT_API_KEY },
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new RiotApiError("Match timeline not found", 404);
  }
  if (res.status === 429) {
    throw new RiotApiError("Riot API rate limit exceeded", 429);
  }
  if (!res.ok) {
    throw new RiotApiError(`Riot API error: ${res.status}`, res.status);
  }

  const data = (await res.json()) as {
    info: {
      frames: {
        events: {
          type: string;
          timestamp: number;
          killerId?: number;
          victimId?: number;
          assistingParticipantIds?: number[];
        }[];
      }[];
    };
  };

  return data.info.frames
    .flatMap((frame) => frame.events)
    .filter((event) => event.type === "CHAMPION_KILL")
    .map((event) => ({
      timestampSeconds: Math.round(event.timestamp / 1000),
      killerParticipantId: event.killerId ?? 0,
      victimParticipantId: event.victimId ?? 0,
      assistingParticipantIds: event.assistingParticipantIds ?? [],
    }));
}

let cachedDdragonVersion: { value: string; fetchedAt: number } | null = null;
const DDRAGON_VERSION_TTL_MS = 60 * 60 * 1000;

// チャンピオンアイコン表示用のDDragonバージョン。Riot開発ポータルの静的CDNで
// APIキー不要・レート制限も課されないため、1時間キャッシュした上で使い回す。
export async function getLatestDdragonVersion(): Promise<string> {
  if (cachedDdragonVersion && Date.now() - cachedDdragonVersion.fetchedAt < DDRAGON_VERSION_TTL_MS) {
    return cachedDdragonVersion.value;
  }

  const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new RiotApiError(`DDragon error: ${res.status}`, res.status);
  }

  const versions = (await res.json()) as string[];
  const latest = versions[0];
  if (!latest) {
    throw new Error("DDragon returned no versions");
  }

  cachedDdragonVersion = { value: latest, fetchedAt: Date.now() };
  return latest;
}

export async function getAccountByPuuid(puuid: string): Promise<RiotAccount> {
  if (!RIOT_API_KEY) {
    throw new Error("RIOT_API_KEY is not configured");
  }

  const url = `https://${RIOT_REGION}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`;

  const res = await fetch(url, {
    headers: { "X-Riot-Token": RIOT_API_KEY },
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new RiotApiError("Account not found", 404);
  }
  if (res.status === 429) {
    throw new RiotApiError("Riot API rate limit exceeded", 429);
  }
  if (!res.ok) {
    throw new RiotApiError(`Riot API error: ${res.status}`, res.status);
  }

  const data = (await res.json()) as RiotAccount;
  return data;
}

export interface LeagueEntry {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

// ランク情報はmatch-v5等と違いplatform routing(jp1等、Player.platformに保存済みの値)で問い合わせる。
export async function getLeagueEntriesByPuuid(
  puuid: string,
  platform: string,
): Promise<LeagueEntry[]> {
  if (!RIOT_API_KEY) {
    throw new Error("RIOT_API_KEY is not configured");
  }

  const url = `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`;

  const res = await fetch(url, {
    headers: { "X-Riot-Token": RIOT_API_KEY },
    cache: "no-store",
  });

  if (res.status === 404) {
    return [];
  }
  if (res.status === 429) {
    throw new RiotApiError("Riot API rate limit exceeded", 429);
  }
  if (!res.ok) {
    throw new RiotApiError(`Riot API error: ${res.status}`, res.status);
  }

  return (await res.json()) as LeagueEntry[];
}
