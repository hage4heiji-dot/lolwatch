// Riotデータリクエストから匿名で集めた「通報された回数」の統計
// (/how-to-check-reports の「みんなと比べる」用)。
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

// これ未満の参加人数では順位を出さない(数人だと「上位○%」が意味を持たず、
// 数値から個人を推測されやすくもなるため)。
export const MIN_PARTICIPANTS_FOR_RANKING = 10;

// 分布表示の区切り(下限値)。最後の区切り以上はまとめて「◯回以上」とする。
const DISTRIBUTION_BUCKETS = [0, 1, 5, 10, 20, 50, 100];

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

export async function getRiotReportComparison(myReceived: number): Promise<RiotReportComparison> {
  // 参加者数が数万規模になるまでは全件の値だけ取ってアプリ側で集計して十分。
  const rows = await prisma.riotReportStat.findMany({ select: { receivedTotal: true } });
  const values = rows.map((r) => r.receivedTotal).sort((a, b) => a - b);
  const participants = values.length;

  if (participants < MIN_PARTICIPANTS_FOR_RANKING) {
    return {
      participants,
      myReceived,
      moreThanMePercent: null,
      topPercent: null,
      average: null,
      median: null,
      distribution: null,
    };
  }

  const moreThanMe = values.filter((v) => v > myReceived).length;
  const atLeastMe = values.filter((v) => v >= myReceived).length;
  const mid = Math.floor(participants / 2);
  const median = participants % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];

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
    distribution: counts.map((count, i) => ({ label: bucketLabel(i), count, isMine: i === myBucket })),
  };
}
