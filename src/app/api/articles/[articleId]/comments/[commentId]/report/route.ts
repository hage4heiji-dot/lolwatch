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
import { checkCommentReportRateLimit } from "@/lib/rateLimit";

const requestSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string; commentId: string }> },
) {
  const { commentId } = await params;

  const ip = getClientIp(request);
  const rateCheck = checkCommentReportRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
  }

  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "通報理由を3文字以上で入力してください。" }, { status: 400 });
  }

  const comment = await prisma.articleComment.findUnique({ where: { id: commentId } });
  if (!comment) {
    return NextResponse.json({ error: "対象のコメントが見つかりません。" }, { status: 404 });
  }

  const existingDeviceId = readDeviceId(request);
  const deviceId = existingDeviceId ?? generateDeviceId();

  // 同一端末からの重複通報は新規作成せず、既存の通報をそのまま「通報済み」として扱う
  // (削除申請(ReportDeletionRequest)と同じ理由で冪等にする)。
  const existing = await prisma.articleCommentReport.findUnique({
    where: { articleCommentId_deviceId: { articleCommentId: commentId, deviceId } },
  });
  if (!existing) {
    await prisma.articleCommentReport.create({
      data: { articleCommentId: commentId, deviceId, posterIp: ip, reason: parsed.data.reason },
    });
  }

  const res = NextResponse.json({ ok: true, alreadyReported: Boolean(existing) });
  if (!existingDeviceId) {
    res.cookies.set(DEVICE_ID_COOKIE, deviceId, DEVICE_ID_COOKIE_OPTIONS);
  }
  return res;
}
