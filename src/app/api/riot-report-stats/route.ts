import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/ip";
import { checkRiotStatRateLimit } from "@/lib/rateLimit";
import { chatSummaryFromRow, getRiotReportComparison, toAccountKey } from "@/lib/riotReportStats";
import { getAccountByRiotId, getSummonerByPuuid } from "@/lib/riot";

// Riotのデータリクエストから読み取った通報回数を、本人の同意のもと匿名で登録し、
// 他の参加者と比べた位置(上位○%など)を返す。同じアカウントからの再送信は上書き。
// 値は自己申告なので、明らかにおかしな値だけ弾き、それ以上の検証はしない。

const MAX_COUNT = 100_000;
const countMap = z
  .record(z.string().regex(/^[A-Z0-9_]{1,64}$/), z.number().int().min(0).max(MAX_COUNT))
  .refine((m) => Object.keys(m).length <= 50, "カテゴリが多すぎます");

// summoner.jsonのlol_platformとして来うる値(Riot APIのプラットフォームID)。
const PLATFORMS = [
  "BR1",
  "EUN1",
  "EUW1",
  "JP1",
  "KR",
  "LA1",
  "LA2",
  "ME1",
  "NA1",
  "OC1",
  "PH2",
  "RU",
  "SG2",
  "TH2",
  "TR1",
  "TW2",
  "VN2",
] as const;

const LEVEL_LOOKUP_TIMEOUT_MS = 5000;

const requestSchema = z.object({
  // ブラウザでRiot IDをSHA-256した16進文字列。重複登録を防ぐキーの元になる。
  riotIdHash: z.string().regex(/^[0-9a-f]{64}$/),
  // サモナーレベル取得のためだけに一時的に受け取るRiot ID("名前#タグ")と地域。DBには保存しない。
  riotId: z
    .object({
      name: z.string().min(3).max(64).includes("#"),
      // 想定外の地域でも送信自体は受け付け、レベル取得だけ省く。
      platform: z.string().max(8),
    })
    .optional(),
  receivedByCategory: countMap,
  madeByCategory: countMap,
  penaltyCount: z.number().int().min(0).max(1000),
  // チャットログの要約(数値のみ。本文は受け取らない)。
  chat: z
    .object({
      games: z.number().int().min(1).max(10_000),
      activeGames: z.number().int().min(0).max(10_000),
      messages: z.number().int().min(0).max(1_000_000),
      allMessages: z.number().int().min(0).max(1_000_000),
      harshMessages: z.number().int().min(0).max(1_000_000),
    })
    .refine(
      (c) =>
        c.activeGames <= c.games && c.allMessages <= c.messages && c.harshMessages <= c.messages,
    )
    .optional(),
  // LoLの累計課金額(RP購入履歴の合計、円)と購入回数。日本円の履歴だけのときに送られる。
  spend: z
    .object({
      yen: z.number().int().min(0).max(100_000_000),
      purchases: z.number().int().min(0).max(100_000),
    })
    .optional(),
});

// ブラウザ側(riot-data-reader.tsxのhashRiotId)と同じ方法でハッシュし、
// 送られてきたRiot IDとriotIdHashが同じアカウントのものかを確かめる。
function hashRiotId(name: string, platform: string): string {
  return createHash("sha256")
    .update(`${platform}:${name.normalize("NFKC").toLowerCase()}`)
    .digest("hex");
}

// Riot APIでサモナーレベルを取る。比較の補助情報なので、失敗・遅延しても送信自体は成功させる。
async function lookupSummonerLevel(name: string, platform: string): Promise<number | null> {
  const separator = name.lastIndexOf("#");
  const gameName = name.slice(0, separator);
  const tagLine = name.slice(separator + 1);
  if (!gameName || !tagLine) return null;
  const lookup = (async () => {
    const account = await getAccountByRiotId(gameName, tagLine);
    const summoner = await getSummonerByPuuid(account.puuid, platform.toLowerCase());
    return summoner.summonerLevel;
  })();
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), LEVEL_LOOKUP_TIMEOUT_MS),
  );
  return Promise.race([lookup, timeout]).catch((err) => {
    console.error("サモナーレベルの取得に失敗:", err);
    return null;
  });
}

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

  const { riotIdHash, riotId, receivedByCategory, madeByCategory, penaltyCount, chat, spend } =
    parsed.data;
  if (riotId && hashRiotId(riotId.name, riotId.platform) !== riotIdHash) {
    return NextResponse.json({ error: "送信内容が不正です。" }, { status: 400 });
  }
  const receivedTotal = sum(receivedByCategory);
  const madeTotal = sum(madeByCategory);
  if (receivedTotal > MAX_COUNT || madeTotal > MAX_COUNT) {
    return NextResponse.json({ error: "送信内容が不正です。" }, { status: 400 });
  }

  const accountKey = toAccountKey(riotIdHash);
  const canLookupLevel =
    riotId !== undefined && (PLATFORMS as readonly string[]).includes(riotId.platform);
  const summonerLevel = canLookupLevel
    ? await lookupSummonerLevel(riotId.name, riotId.platform)
    : null;
  const data = {
    receivedTotal,
    madeTotal,
    receivedByCategory,
    madeByCategory,
    penaltyCount,
    // 取得に失敗した再送信で、前回取れていたレベルを消さないようにする。
    ...(summonerLevel !== null ? { summonerLevel } : {}),
    ...(chat
      ? {
          chatGames: chat.games,
          chatActiveGames: chat.activeGames,
          chatMessages: chat.messages,
          chatAllMessages: chat.allMessages,
          chatHarshMessages: chat.harshMessages,
        }
      : {}),
    ...(spend ? { spendYen: spend.yen, spendPurchases: spend.purchases } : {}),
  };
  const row = await prisma.riotReportStat.upsert({
    where: { accountKey },
    create: { accountKey, ...data },
    update: data,
    select: {
      id: true,
      updatedAt: true,
      summonerLevel: true,
      chatGames: true,
      chatActiveGames: true,
      chatMessages: true,
      chatAllMessages: true,
      chatHarshMessages: true,
    },
  });

  const comparison = await getRiotReportComparison(
    receivedTotal,
    madeTotal,
    receivedByCategory,
    row.summonerLevel,
    chatSummaryFromRow(row),
    spend ?? null,
  );
  // idは共有ページ(/how-to-check-reports/result/[id])用。同じアカウントなら再送信しても変わらない。
  // versionは共有URLの末尾(?v=)に付ける。Xは同じURLのカード画像を長く使い回すので、
  // 送り直すたびにURLを変えて新しいOGP画像を取りに来させる。
  return NextResponse.json({ ok: true, id: row.id, version: row.updatedAt.getTime(), comparison });
}
