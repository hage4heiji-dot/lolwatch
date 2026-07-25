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
import { checkDeletionRequestRateLimit } from "@/lib/rateLimit";

const requestSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;

  const ip = getClientIp(request);
  const rateCheck = checkDeletionRequestRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
  }

  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "削除申請の理由を3文字以上で入力してください。" }, { status: 400 });
  }

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) {
    return NextResponse.json({ error: "対象の通報が見つかりません。" }, { status: 404 });
  }

  const existingDeviceId = readDeviceId(request);
  const deviceId = existingDeviceId ?? generateDeviceId();

  // 同一端末からの重複申請は新規作成せず、既存の申請をそのまま「申請済み」として扱う
  // (異議申立と違い理由付きの一回性の申請のため、トグルではなく冪等にする)。
  const existing = await prisma.reportDeletionRequest.findUnique({
    where: { reportId_deviceId: { reportId, deviceId } },
  });
  if (!existing) {
    await prisma.reportDeletionRequest.create({
      data: { reportId, deviceId, posterIp: ip, reason: parsed.data.reason },
    });
  }

  const requestCount = await prisma.reportDeletionRequest.count({ where: { reportId } });

  const res = NextResponse.json({ ok: true, requestCount, alreadyRequested: Boolean(existing) });
  if (!existingDeviceId) {
    res.cookies.set(DEVICE_ID_COOKIE, deviceId, DEVICE_ID_COOKIE_OPTIONS);
  }
  return res;
}
