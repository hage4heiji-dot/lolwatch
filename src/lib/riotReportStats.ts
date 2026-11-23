// Riotデータリクエストから匿名で集めた「通報された回数」の統計
// (/how-to-check-reports の「みんなと比べる」用)。
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  getQuadrant,
  getReportLean,
  type QuadrantKey,
  type ReportLean,
} from "@/lib/reportCountTitle";
import {
  buildReceivedDistribution,
  reportsPer100Levels,
  type DistributionBin,
} from "@/lib/reportChartScale";
import { chatRates, type ChatSummary } from "@/lib/chatStats";

// これ未満の参加人数では順位を出さない(数人だと「上位○%」が意味を持たず、
// 数値から個人を推測されやすくもなるため)。
export const MIN_PARTICIPANTS_FOR_RANKING = 10;

// 参加者が少なく中央値が使えない間の仮の境界線(この値より多ければ「多い」側)。
// 中央値の代わりにタイプを出せるようにするためのもの。
export const PROVISIONAL_BOUNDARY = { received: 10, made: 5 };

// 4象限グラフに描く他の参加者の点の上限(多すぎると重いので間引く)。
const MAX_QUADRANT_POINTS = 600;

export type RiotReportComparison = {
  participants: number;
  myReceived: number;
  // 自分より通報された回数が多い人の割合(%)。自分を含めた全参加者が分母。
  // 参加者がMIN_PARTICIPANTS_FOR_RANKING未満ならnull。
  moreThanMePercent: number | null;
  // 「上位○%」(通報された回数が自分以上の人の割合)。参加者不足ならnull。
  topPercent: number | null;
  average: number | null;
  median: number | null;
  // 通報された回数の分布(20回刻み)。参加者が少ない間も出す(人数を数えるだけで個人は特定できない)。
  distribution: DistributionBin[] | null;
  // 通報された回数(縦)×通報した回数(横)の4象限。参加者不足ならnull。
  quadrant: {
    myMade: number;
    medianReceived: number;
    medianMade: number;
    type: QuadrantKey;
    // 通報された理由の傾向(言動系/プレイ系)。タイプ名の頭と点の色に使う。
    lean: ReportLean;
    // trueなら境界線は中央値ではなくPROVISIONAL_BOUNDARY(参加者不足の間)。
    provisional: boolean;
    // 参加者の [通報した回数, 通報された回数, 傾向]。匿名の点としてだけ使う。
    points: [number, number, ReportLean][];
  } | null;
  // 「レベル100あたりの通報された回数」(サモナーレベルを試合数の目安にした指標)。
  perLevel: {
    // 自分のレベルが取れなかった場合はnull(その場合も他の参加者の点は返す)。
    myLevel: number | null;
    myPer100: number | null;
    // レベルあたりで見たときの「上位○%」。レベルが分かる参加者が足りない・自分のレベル不明ならnull。
    topPercent: number | null;
    // レベルが分かる参加者の [通報された回数, レベル100あたり, 傾向]。
    points: [number, number, ReportLean][];
  };
  // チャットログ(直近の試合ぶん)の要約と、参加者平均との比較。
  chat: {
    mine: ChatSummary | null;
    // チャットログを送ってくれた参加者数
    participants: number;
    // 参加者平均(チャットありの参加者がMIN_PARTICIPANTS_FOR_RANKING未満ならnull)
    average: { activeRate: number; perGame: number; harshPer100Games: number } | null;
  };
};

// ブラウザから届くRiot IDのSHA-256(16進)を、サーバーの秘密鍵でHMACして保存用のキーにする。
// DBだけが漏れても、既知のRiot ID一覧と突き合わせて誰のデータか特定できないようにするため。
export function toAccountKey(riotIdHash: string): string {
  const secret = process.env.RIOT_STAT_HMAC_SECRET;
  if (!secret) throw new Error("RIOT_STAT_HMAC_SECRET が設定されていません");
  return createHmac("sha256", secret).update(riotIdHash).digest("hex");
}

// DBのJson列(理由別の回数)を数値のマップとして読む。想定外の形の値は無視する。
export function asCountMap(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((e): e is [string, number] => typeof e[1] === "number"),
  );
}

function medianOf(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function getRiotReportComparison(
  myReceived: number,
  myMade: number,
  myReceivedByCategory: Record<string, number>,
  myLevel: number | null,
  myChat: ChatSummary | null,
): Promise<RiotReportComparison> {
  // 参加者数が数万規模になるまでは全件の値だけ取ってアプリ側で集計して十分。
  const rows = await prisma.riotReportStat.findMany({
    select: {
      receivedTotal: true,
      madeTotal: true,
      receivedByCategory: true,
      summonerLevel: true,
      chatGames: true,
      chatActiveGames: true,
      chatMessages: true,
      chatAllMessages: true,
      chatHarshMessages: true,
    },
  });
  const values = rows.map((r) => r.receivedTotal).sort((a, b) => a - b);
  const participants = values.length;

  // 4象限グラフに描く参加者の点(人数が少ない間も描く。値は回数だけで個人は特定できない)。
  const step = Math.max(1, Math.ceil(rows.length / MAX_QUADRANT_POINTS));
  const points = rows
    .filter((_, i) => i % step === 0)
    .map(
      (r) =>
        [r.madeTotal, r.receivedTotal, getReportLean(asCountMap(r.receivedByCategory))] as [
          number,
          number,
          ReportLean,
        ],
    );
  const myLean = getReportLean(myReceivedByCategory);

  // レベル100あたりの通報された回数。レベルが分かる参加者だけで集計する。
  const perLevelRows = rows
    .map((r) => ({
      received: r.receivedTotal,
      per100: reportsPer100Levels(r.receivedTotal, r.summonerLevel),
      lean: getReportLean(asCountMap(r.receivedByCategory)),
    }))
    .filter((r): r is { received: number; per100: number; lean: ReportLean } => r.per100 !== null);
  const myPer100 = reportsPer100Levels(myReceived, myLevel);
  const perLevelStep = Math.max(1, Math.ceil(perLevelRows.length / MAX_QUADRANT_POINTS));
  const chatRows = rows.flatMap((r) => {
    const summary = chatSummaryFromRow(r);
    return summary ? [summary] : [];
  });
  const chat: RiotReportComparison["chat"] = {
    mine: myChat,
    participants: chatRows.length,
    average:
      chatRows.length >= MIN_PARTICIPANTS_FOR_RANKING
        ? {
            activeRate:
              Math.round(
                (chatRows.reduce((a, c) => a + chatRates(c).activeRate, 0) / chatRows.length) * 10,
              ) / 10,
            perGame:
              Math.round(
                (chatRows.reduce((a, c) => a + chatRates(c).perGame, 0) / chatRows.length) * 100,
              ) / 100,
            harshPer100Games:
              Math.round(
                (chatRows.reduce((a, c) => a + (c.harshMessages / c.games) * 100, 0) /
                  chatRows.length) *
                  10,
              ) / 10,
          }
        : null,
  };

  const perLevel: RiotReportComparison["perLevel"] = {
    myLevel,
    myPer100,
    topPercent:
      myPer100 !== null && perLevelRows.length >= MIN_PARTICIPANTS_FOR_RANKING
        ? Math.round(
            (perLevelRows.filter((r) => r.per100 >= myPer100).length / perLevelRows.length) * 1000,
          ) / 10
        : null,
    points: perLevelRows
      .filter((_, i) => i % perLevelStep === 0)
      .map((r) => [r.received, r.per100, r.lean] as [number, number, ReportLean]),
  };

  if (participants < MIN_PARTICIPANTS_FOR_RANKING) {
    return {
      participants,
      myReceived,
      moreThanMePercent: null,
      topPercent: null,
      average: null,
      median: null,
      distribution: buildReceivedDistribution(values, myReceived),
      quadrant: {
        myMade,
        medianReceived: PROVISIONAL_BOUNDARY.received,
        medianMade: PROVISIONAL_BOUNDARY.made,
        type: getQuadrant(
          myReceived,
          myMade,
          PROVISIONAL_BOUNDARY.received,
          PROVISIONAL_BOUNDARY.made,
        ),
        lean: myLean,
        provisional: true,
        points,
      },
      perLevel,
      chat,
    };
  }

  const moreThanMe = values.filter((v) => v > myReceived).length;
  const atLeastMe = values.filter((v) => v >= myReceived).length;
  const median = medianOf(values);
  const medianMade = medianOf(rows.map((r) => r.madeTotal).sort((a, b) => a - b));

  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    participants,
    myReceived,
    moreThanMePercent: round1((moreThanMe / participants) * 100),
    topPercent: round1((atLeastMe / participants) * 100),
    average: round1(values.reduce((a, b) => a + b, 0) / participants),
    median,
    distribution: buildReceivedDistribution(values, myReceived),
    quadrant: {
      myMade,
      medianReceived: median,
      medianMade,
      type: getQuadrant(myReceived, myMade, median, medianMade),
      lean: myLean,
      provisional: false,
      points,
    },
    perLevel,
    chat,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 共有ページ用。accountKeyは返さない(共有URLから識別子をたどれないようにする)。
export async function getRiotReportStatForShare(id: string) {
  if (!UUID_RE.test(id)) return null;
  return prisma.riotReportStat.findUnique({
    where: { id },
    select: {
      receivedTotal: true,
      madeTotal: true,
      receivedByCategory: true,
      penaltyCount: true,
      summonerLevel: true,
      chatGames: true,
      chatActiveGames: true,
      chatMessages: true,
      chatAllMessages: true,
      chatHarshMessages: true,
    },
  });
}

// DBの行からチャット要約を組み立てる(チャットログが無かった人はnull)。
export function chatSummaryFromRow(row: {
  chatGames: number | null;
  chatActiveGames: number | null;
  chatMessages: number | null;
  chatAllMessages: number | null;
  chatHarshMessages: number | null;
}): ChatSummary | null {
  if (!row.chatGames) return null;
  return {
    games: row.chatGames,
    activeGames: row.chatActiveGames ?? 0,
    messages: row.chatMessages ?? 0,
    allMessages: row.chatAllMessages ?? 0,
    harshMessages: row.chatHarshMessages ?? 0,
  };
}
