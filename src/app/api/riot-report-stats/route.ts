import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/ip";
import { checkRiotStatRateLimit } from "@/lib/rateLimit";
import { getRiotReportComparison, toAccountKey } from "@/lib/riotReportStats";

// Riotのデータリクエストから読み取った通報回数を、本人の同意のもと匿名で登録し、
// 他の参加者と比べた位置(上位○%など)を返す。同じアカウントからの再送信は上書き。
// 値は自己申告なので、明らかにおかしな値だけ弾き、それ以上の検証はしない。

const MAX_COUNT = 100_000;
const countMap = z
  .record(z.string().regex(/^[A-Z0-9_]{1,64}$/), z.number().int().min(0).max(MAX_COUNT))
  .refine((m) => Object.keys(m).length <= 50, "カテゴリが多すぎます");

const requestSchema = z.object({
  // ブラウザでRiot IDをSHA-256した16進文字列。Riot ID自体は受け取らない。
  riotIdHash: z.string().regex(/^[0-9a-f]{64}$/),
  receivedByCategory: countMap,
  madeByCategory: countMap,
  penaltyCount: z.number().int().min(0).max(1000),
});

function sum(m: Record<string, number>): number {
  return Object.values(m).reduce((a, b) => a + b, 0);
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "送信内容が不正です。" }, { status: 400 });
  }

  const rateCheck = checkRiotStatRateLimit(getClientIp(request));
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
  }

  const { riotIdHash, receivedByCategory, madeByCategory, penaltyCount } = parsed.data;
  const receivedTotal = sum(receivedByCategory);
  const madeTotal = sum(madeByCategory);
  if (receivedTotal > MAX_COUNT || madeTotal > MAX_COUNT) {
    return NextResponse.json({ error: "送信内容が不正です。" }, { status: 400 });
  }

  const accountKey = toAccountKey(riotIdHash);
  const data = { receivedTotal, madeTotal, receivedByCategory, madeByCategory, penaltyCount };
  await prisma.riotReportStat.upsert({
    where: { accountKey },
    create: { accountKey, ...data },
    update: data,
  });

  const comparison = await getRiotReportComparison(receivedTotal);
  return NextResponse.json({ ok: true, comparison });
}
