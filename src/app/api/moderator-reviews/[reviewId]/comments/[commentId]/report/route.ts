import { NextResponse, after } from "next/server";
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
import { DISCORD_COLORS, SITE_URL, discordQuote, formatRiotId, notifyDiscord } from "@/lib/discord";

const requestSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

// 判定へのコメントに対する「不適切」通報。記事コメントの通報APIと同じ作り。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string; commentId: string }> },
) {
  const { reviewId, commentId } = await params;

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

  const comment = await prisma.reviewComment.findUnique({
    where: { id: commentId },
    include: {
      moderatorReview: {
        select: {
          report: {
            select: {
              player: {
                select: {
                  puuid: true,
                  nameHistory: {
                    where: { isCurrent: true },
                    take: 1,
                    select: { riotIdName: true, riotIdTagLine: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!comment || comment.moderatorReviewId !== reviewId) {
    return NextResponse.json({ error: "対象のコメントが見つかりません。" }, { status: 404 });
  }

  const existingDeviceId = readDeviceId(request);
  const deviceId = existingDeviceId ?? generateDeviceId();

  // 同一端末からの重複通報は冪等に扱う(記事コメントの通報と同じ)。
  const existing = await prisma.reviewCommentReport.findUnique({
    where: { reviewCommentId_deviceId: { reviewCommentId: commentId, deviceId } },
  });
  if (!existing) {
    await prisma.reviewCommentReport.create({
      data: { reviewCommentId: commentId, deviceId, posterIp: ip, reason: parsed.data.reason },
    });
    const player = comment.moderatorReview.report.player;
    after(() =>
      notifyDiscord("alerts", {
        label: "🚩 判定コメントへの通報",
        title: formatRiotId(player.nameHistory[0]),
        url: `${SITE_URL}/moderator/review/${encodeURIComponent(player.puuid)}`,
        color: DISCORD_COLORS.red,
        fields: [
          { name: "通報されたコメント", value: discordQuote(comment.body) },
          { name: "通報理由", value: discordQuote(parsed.data.reason) },
        ],
      }),
    );
  }

  const res = NextResponse.json({ ok: true, alreadyReported: Boolean(existing) });
  if (!existingDeviceId) {
    res.cookies.set(DEVICE_ID_COOKIE, deviceId, DEVICE_ID_COOKIE_OPTIONS);
  }
  return res;
}
