// 「サンプルを見る」用の架空データ。zipを選ぶ前に結果画面の見た目を確認してもらうためのもので、
// 実在のプレイヤーとは関係ない。サーバーへは一切送信しない。
import type { RiotReportComparison } from "@/lib/riotReportStats";
import type { ChatSummary, HarshSample } from "@/lib/chatStats";
import type { ReportLean } from "@/lib/reportCountTitle";

export const SAMPLE_RECEIVED_BY_CATEGORY: Record<string, number> = {
  ASSISTING_ENEMY_TEAM: 6,
  VERBAL_ABUSE: 5,
  LEAVING_AFK: 4,
  RANK_MANIPULATION: 2,
  NEGATIVE_ATTITUDE: 1,
};

export const SAMPLE_MADE_BY_CATEGORY: Record<string, number> = {
  VERBAL_ABUSE: 4,
  ASSISTING_ENEMY_TEAM: 3,
  LEAVING_AFK: 2,
};

export const SAMPLE_PENALTIES = [
  {
    date_issued: "2026-06-14T12:30:00Z",
    restriction_reason: "LEAVER_BUSTER",
    scope: "LEAGUE_OF_LEGENDS",
    sentence: "PERMANENT",
    status: "LAPSED",
  },
];

export const SAMPLE_CHAT: ChatSummary = {
  games: 100,
  activeGames: 38,
  messages: 92,
  allMessages: 6,
  harshMessages: 3,
};

export const SAMPLE_HARSH: HarshSample[] = [
  { phase: "試合中", word: "下手くそ", text: "下手くそすぎて草" },
  { phase: "試合中", word: "戦犯", text: "今の集団戦の戦犯だれ" },
  { phase: "試合後", word: "noob", text: "noob jg diff" },
];

// 0〜1の疑似乱数(毎回同じ並びになるよう固定シード)。
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function samplePoints(): {
  quadrant: [number, number, ReportLean][];
  perLevel: [number, number, ReportLean][];
} {
  const rand = seeded(42);
  const leans: ReportLean[] = ["conduct", "play", "none"];
  const quadrant: [number, number, ReportLean][] = [];
  const perLevel: [number, number, ReportLean][] = [];
  for (let i = 0; i < 48; i++) {
    // 回数は少ない人が多く、一部だけ大きい分布にする。
    const received = Math.round(Math.pow(rand(), 2.2) * 60);
    const made = Math.round(Math.pow(rand(), 2) * 25);
    const level = 30 + Math.round(rand() * 600);
    const lean = received === 0 ? "none" : leans[Math.floor(rand() * 3)];
    quadrant.push([made, received, lean]);
    perLevel.push([received, Math.round((received / level) * 1000) / 10, lean]);
  }
  return { quadrant, perLevel };
}

const points = samplePoints();

export const SAMPLE_COMPARISON: RiotReportComparison = {
  participants: 48,
  myReceived: 18,
  moreThanMePercent: 20.8,
  topPercent: 22.9,
  average: 9.4,
  median: 5,
  distribution: null,
  quadrant: {
    myMade: 9,
    medianReceived: 5,
    medianMade: 3,
    type: "clash",
    lean: "play",
    provisional: false,
    points: points.quadrant,
  },
  perLevel: {
    myLevel: 240,
    myPer100: 7.5,
    topPercent: 18.8,
    points: points.perLevel,
  },
  chat: {
    mine: SAMPLE_CHAT,
    participants: 41,
    average: { activeRate: 31.5, perGame: 0.74, harshPer100Games: 2.1 },
  },
};
