import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEVICE_ID_COOKIE,
  DEVICE_ID_COOKIE_OPTIONS,
  generateDeviceId,
  readDeviceId,
} from "@/lib/deviceId";
import { getClientIp } from "@/lib/ip";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const { reviewId } = await params;

  const review = await prisma.moderatorReview.findUnique({ where: { id: reviewId } });
  if (!review) {
    return NextResponse.json({ error: "対象の評価が見つかりません。" }, { status: 404 });
  }

  const existingDeviceId = readDeviceId(request);
  const deviceId = existingDeviceId ?? generateDeviceId();
  const ip = getClientIp(request);

  const existing = await prisma.reviewObjection.findUnique({
    where: { moderatorReviewId_deviceId: { moderatorReviewId: reviewId, deviceId } },
  });

  if (existing) {
    // もう一度押したら取り消し(異議を撤回)扱いにする。
    await prisma.reviewObjection.delete({ where: { id: existing.id } });
  } else {
    await prisma.reviewObjection.create({
      data: { moderatorReviewId: reviewId, deviceId, posterIp: ip },
    });
  }

  const objectionCount = await prisma.reviewObjection.count({
    where: { moderatorReviewId: reviewId },
  });

  const res = NextResponse.json({ objectionCount, hasObjected: !existing });
  if (!existingDeviceId) {
    res.cookies.set(DEVICE_ID_COOKIE, deviceId, DEVICE_ID_COOKIE_OPTIONS);
  }
  return res;
}
