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
import {
  checkReviewCommentRateLimit,
  acquireInFlightLock,
  releaseInFlightLock,
} from "@/lib/rateLimit";
import { VERDICT_LABELS, VERDICT_ICONS } from "@/lib/moderatorVerdicts";
import { DISCORD_COLORS, SITE_URL, discordQuote, formatRiotId, notifyDiscord } from "@/lib/discord";

const requestSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

// 判定(ModeratorReview)への公開コメント投稿。記事コメント(api/articles/[articleId]/comments)と同じ作り。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const { reviewId } = await params;

  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "コメントは1〜500文字で入力してください。" },
      { status: 400 },
    );
  }

  const review = await prisma.moderatorReview.findUnique({
    where: { id: reviewId },
    include: {
      report: {
        select: {
          hiddenAt: true,
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
  });
  // 非表示にされた通報への判定は公開ページに出ないため、コメントも受け付けない。
  if (!review || review.report.hiddenAt) {
    return NextResponse.json({ error: "対象の判定が見つかりません。" }, { status: 404 });
  }

  const existingDeviceId = readDeviceId(request);
  const deviceId = existingDeviceId ?? generateDeviceId();
  const ip = getClientIp(request);

  function respond(body: unknown, status: number) {
    const res = NextResponse.json(body, { status });
    if (!existingDeviceId) {
      res.cookies.set(DEVICE_ID_COOKIE, deviceId, DEVICE_ID_COOKIE_OPTIONS);
    }
    return res;
  }

  // 通報投稿・記事コメントと同じく、レート制限チェックと作成の間の二重送信を防ぐ。
  const lockKey = `review-comment:${ip}`;
  if (!acquireInFlightLock(lockKey)) {
    return respond({ error: "処理中です。しばらくしてから再度お試しください。" }, 429);
  }

  try {
    const rateCheck = await checkReviewCommentRateLimit({ deviceId, ip });
    if (!rateCheck.allowed) {
      return respond({ error: rateCheck.reason }, 429);
    }

    const comment = await prisma.reviewComment.create({
      data: { moderatorReviewId: reviewId, body: parsed.data.body, deviceId, posterIp: ip },
    });

    after(() =>
      notifyDiscord("activity", {
        label: "💬 判定へのコメント",
        title: formatRiotId(review.report.player.nameHistory[0]),
        url: `${SITE_URL}/players/${encodeURIComponent(review.report.player.puuid)}`,
        color: DISCORD_COLORS.blue,
        description: discordQuote(comment.body),
        fields: [
          {
            name: "対象の判定",
            value: `${VERDICT_ICONS[review.verdict]} ${VERDICT_LABELS[review.verdict]}`,
            inline: true,
          },
        ],
      }),
    );

    return respond(
      { ok: true, comment: { id: comment.id, body: comment.body, createdAt: comment.createdAt } },
      201,
    );
  } finally {
    releaseInFlightLock(lockKey);
  }
}
