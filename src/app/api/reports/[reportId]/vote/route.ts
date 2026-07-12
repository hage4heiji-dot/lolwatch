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

const bodySchema = z.object({ voteType: z.enum(["LIKE", "DISLIKE"]) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力内容が不正です。" }, { status: 400 });
  }

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) {
    return NextResponse.json({ error: "対象の通報が見つかりません。" }, { status: 404 });
  }

  const existingDeviceId = readDeviceId(request);
  const deviceId = existingDeviceId ?? generateDeviceId();
  const ip = getClientIp(request);

  const existingVote = await prisma.reportVote.findUnique({
    where: { reportId_deviceId: { reportId, deviceId } },
  });

  if (existingVote && existingVote.voteType === parsed.data.voteType) {
    // 同じボタンをもう一度押した場合は取り消し扱いにする。
    await prisma.reportVote.delete({ where: { id: existingVote.id } });
  } else {
    await prisma.reportVote.upsert({
      where: { reportId_deviceId: { reportId, deviceId } },
      update: { voteType: parsed.data.voteType },
      create: { reportId, deviceId, posterIp: ip, voteType: parsed.data.voteType },
    });
  }

  const [likeCount, dislikeCount, myVote] = await Promise.all([
    prisma.reportVote.count({ where: { reportId, voteType: "LIKE" } }),
    prisma.reportVote.count({ where: { reportId, voteType: "DISLIKE" } }),
    prisma.reportVote.findUnique({ where: { reportId_deviceId: { reportId, deviceId } } }),
  ]);

  const res = NextResponse.json({ likeCount, dislikeCount, myVote: myVote?.voteType ?? null });
  if (!existingDeviceId) {
    res.cookies.set(DEVICE_ID_COOKIE, deviceId, DEVICE_ID_COOKIE_OPTIONS);
  }
  return res;
}
