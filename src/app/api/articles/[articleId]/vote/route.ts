import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  DEVICE_ID_COOKIE,
  DEVICE_ID_COOKIE_OPTIONS,
  generateDeviceId,
  readDeviceId,
} from "@/lib/deviceId";
import { getClientIp } from "@/lib/ip";
import { checkArticleVoteRateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({ score: z.number().int().min(1).max(5) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> },
) {
  const { articleId } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力内容が不正です。" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rateCheck = checkArticleVoteRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
  }

  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article || !article.publishedAt) {
    return NextResponse.json({ error: "対象の記事が見つかりません。" }, { status: 404 });
  }

  const existingDeviceId = readDeviceId(request);
  const deviceId = existingDeviceId ?? generateDeviceId();

  const existingVote = await prisma.articleVote.findUnique({
    where: { articleId_deviceId: { articleId, deviceId } },
  });

  if (existingVote && existingVote.score === parsed.data.score) {
    // 同じ値をもう一度選んだ場合は取り消し扱いにする。
    await prisma.articleVote.delete({ where: { id: existingVote.id } });
  } else {
    await prisma.articleVote.upsert({
      where: { articleId_deviceId: { articleId, deviceId } },
      update: { score: parsed.data.score },
      create: { articleId, deviceId, posterIp: ip, score: parsed.data.score },
    });
  }

  const [counts, myVote] = await Promise.all([
    prisma.articleVote.groupBy({ by: ["score"], where: { articleId }, _count: { score: true } }),
    prisma.articleVote.findUnique({ where: { articleId_deviceId: { articleId, deviceId } } }),
  ]);

  const scoreCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of counts) {
    scoreCounts[row.score] = row._count.score;
  }

  const res = NextResponse.json({ scoreCounts, myVote: myVote?.score ?? null });
  if (!existingDeviceId) {
    res.cookies.set(DEVICE_ID_COOKIE, deviceId, DEVICE_ID_COOKIE_OPTIONS);
  }
  return res;
}
