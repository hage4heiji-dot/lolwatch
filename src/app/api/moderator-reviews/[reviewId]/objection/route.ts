import { NextResponse, after } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEVICE_ID_COOKIE,
  DEVICE_ID_COOKIE_OPTIONS,
  generateDeviceId,
  readDeviceId,
} from "@/lib/deviceId";
import { getClientIp } from "@/lib/ip";
import { checkObjectionRateLimit } from "@/lib/rateLimit";
import { DISCORD_COLORS, SITE_URL, notifyDiscord } from "@/lib/discord";
import { VERDICT_LABELS } from "@/lib/moderatorVerdicts";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const { reviewId } = await params;

  const ip = getClientIp(request);
  const rateCheck = checkObjectionRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
  }

  const review = await prisma.moderatorReview.findUnique({
    where: { id: reviewId },
    include: { report: { select: { player: { select: { puuid: true } } } } },
  });
  if (!review) {
    return NextResponse.json({ error: "対象の評価が見つかりません。" }, { status: 404 });
  }

  const existingDeviceId = readDeviceId(request);
  const deviceId = existingDeviceId ?? generateDeviceId();

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

  // 取り消し(撤回)は通知しない。
  if (!existing) {
    after(() =>
      notifyDiscord("alerts", {
        title: `🙋 モデレーター判定への異議 (この判定への異議 計${objectionCount}件)`,
        url: `${SITE_URL}/moderator/review/${encodeURIComponent(review.report.player.puuid)}`,
        color: DISCORD_COLORS.yellow,
        fields: [
          { name: "判定", value: VERDICT_LABELS[review.verdict] },
          { name: "判定理由", value: review.rationale },
        ],
      }),
    );
  }

  const res = NextResponse.json({ objectionCount, hasObjected: !existing });
  if (!existingDeviceId) {
    res.cookies.set(DEVICE_ID_COOKIE, deviceId, DEVICE_ID_COOKIE_OPTIONS);
  }
  return res;
}
