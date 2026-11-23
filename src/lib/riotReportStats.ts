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

// これ未満の参加人数では順位を出さない(数人だと「上位○%」が意味を持たず、
// 数値から個人を推測されやすくもなるため)。
export const MIN_PARTICIPANTS_FOR_RANKING = 10;

// 分布表示の区切り(下限値)。最後の区切り以上はまとめて「◯回以上」とする。
const DISTRIBUTION_BUCKETS = [0, 1, 5, 10, 20, 50, 100];

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
  distribution: { label: string; count: number; isMine: boolean }[] | null;
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
};

// ブラウザから届くRiot IDのSHA-256(16進)を、サーバーの秘密鍵でHMACして保存用のキーにする。
// DBだけが漏れても、既知のRiot ID一覧と突き合わせて誰のデータか特定できないようにするため。
export function toAccountKey(riotIdHash: string): string {
  const secret = process.env.RIOT_STAT_HMAC_SECRET;
  if (!secret) throw new Error("RIOT_STAT_HMAC_SECRET が設定されていません");
  return createHmac("sha256", secret).update(riotIdHash).digest("hex");
}

function bucketLabel(index: number): string {
  const min = DISTRIBUTION_BUCKETS[index];
  const next = DISTRIBUTION_BUCKETS[index + 1];
  if (next === undefined) return `${min}回以上`;
  if (next - min === 1) return `${min}回`;
  return `${min}〜${next - 1}回`;
}

function bucketIndex(value: number): number {
  let index = 0;
  DISTRIBUTION_BUCKETS.forEach((min, i) => {
    if (value >= min) index = i;
  });
  return index;
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
): Promise<RiotReportComparison> {
  // 参加者数が数万規模になるまでは全件の値だけ取ってアプリ側で集計して十分。
  const rows = await prisma.riotReportStat.findMany({
    select: { receivedTotal: true, madeTotal: true, receivedByCategory: true },
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

  if (participants < MIN_PARTICIPANTS_FOR_RANKING) {
    return {
      participants,
      myReceived,
      moreThanMePercent: null,
      topPercent: null,
      average: null,
      median: null,
      distribution: null,
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
    };
  }

  const moreThanMe = values.filter((v) => v > myReceived).length;
  const atLeastMe = values.filter((v) => v >= myReceived).length;
  const median = medianOf(values);
  const medianMade = medianOf(rows.map((r) => r.madeTotal).sort((a, b) => a - b));

  const counts = DISTRIBUTION_BUCKETS.map(() => 0);
  for (const v of values) counts[bucketIndex(v)]++;
  const myBucket = bucketIndex(myReceived);

  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    participants,
    myReceived,
    moreThanMePercent: round1((moreThanMe / participants) * 100),
    topPercent: round1((atLeastMe / participants) * 100),
    average: round1(values.reduce((a, b) => a + b, 0) / participants),
    median,
    distribution: counts.map((count, i) => ({
      label: bucketLabel(i),
      count,
      isMine: i === myBucket,
    })),
    quadrant: {
      myMade,
      medianReceived: median,
      medianMade,
      type: getQuadrant(myReceived, myMade, median, medianMade),
      lean: myLean,
      provisional: false,
      points,
    },
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
    },
  });
}
