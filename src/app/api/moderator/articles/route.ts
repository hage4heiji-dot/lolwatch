import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ArticleSeverity } from "@/generated/prisma";

// クラウド上の定期実行エージェント(炎上案件の下書き自動作成)専用のエンドポイント。
// モデレーターのログインCookieではなく、専用のBearerトークンで認証する
// (ブラウザセッションを持たない自動化エージェントから叩くため)。
// 常にpublishedAt: nullの下書きとして作成し、このエンドポイント自体には
// 公開権限を持たせない(公開は必ず人間のモデレーターがUIから行う)。

const articleSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  incidentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "incidentDateはYYYY-MM-DD形式で指定してください。"),
  severity: z.enum(ArticleSeverity),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
});

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.ARTICLE_BOT_API_KEY;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}

// 自動投稿エージェントが既存記事との重複を避けるための一覧取得用。
// タイトルと出典URL(本文から抽出できないため、本文全体をそのまま返す)を返す。
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "認証に失敗しました。" }, { status: 401 });
  }

  const articles = await prisma.article.findMany({
    select: {
      id: true,
      title: true,
      tags: true,
      incidentDate: true,
      publishedAt: true,
      archivedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ articles });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "認証に失敗しました。" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = articleSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容が不正です。", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const moderator = await prisma.moderator.findUnique({ where: { username: "admin" } });
  if (!moderator) {
    return NextResponse.json({ error: "投稿先のモデレーターアカウントが見つかりません。" }, { status: 500 });
  }

  const article = await prisma.article.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      tags: parsed.data.tags ?? [],
      incidentDate: new Date(parsed.data.incidentDate),
      severity: parsed.data.severity,
      moderatorId: moderator.id,
      // publishedAtは常にnull(下書き)。このAPIには公開権限を持たせない。
    },
  });

  return NextResponse.json(
    { ok: true, articleId: article.id, editUrl: `/moderator/articles/${article.id}` },
    { status: 201 },
  );
}
