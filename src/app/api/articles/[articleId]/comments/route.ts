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
import {
  checkArticleCommentRateLimit,
  acquireInFlightLock,
  releaseInFlightLock,
} from "@/lib/rateLimit";

const requestSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> },
) {
  const { articleId } = await params;

  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "コメントは1〜500文字で入力してください。" },
      { status: 400 },
    );
  }

  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article || !article.publishedAt) {
    return NextResponse.json({ error: "対象の記事が見つかりません。" }, { status: 404 });
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

  // レート制限チェックと作成の間に同一IPからのリクエストが重ならないようにする
  // (通報投稿と同じ理由。src/app/api/reports/route.tsのコメント参照)。
  const lockKey = `comment:${ip}`;
  if (!acquireInFlightLock(lockKey)) {
    return respond({ error: "処理中です。しばらくしてから再度お試しください。" }, 429);
  }

  try {
    const rateCheck = await checkArticleCommentRateLimit({ deviceId, ip });
    if (!rateCheck.allowed) {
      return respond({ error: rateCheck.reason }, 429);
    }

    // このdeviceIdが同じ記事に投じている投票(違反〜問題なしの1〜5段階)があれば、
    // コメント投稿時点のスナップショットとして一緒に保存する(コメント一覧で
    // 「どちら寄りの人の投稿か」を表示するため)。事後にVoteを変えてもここは固定。
    const existingVote = await prisma.articleVote.findUnique({
      where: { articleId_deviceId: { articleId, deviceId } },
    });

    const comment = await prisma.articleComment.create({
      data: {
        articleId,
        body: parsed.data.body,
        deviceId,
        posterIp: ip,
        voteScoreAtPost: existingVote?.score ?? null,
      },
    });

    return respond(
      {
        ok: true,
        comment: {
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          voteScoreAtPost: comment.voteScoreAtPost,
        },
      },
      201,
    );
  } finally {
    releaseInFlightLock(lockKey);
  }
}
