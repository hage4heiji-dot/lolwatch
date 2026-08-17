import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ArticleSeverity, ArticleKind } from "@/generated/prisma";
import { computeTagStats } from "@/lib/articleGenreStats";

// クラウド上の定期実行エージェント(下書き自動作成)専用のエンドポイント。
// モデレーターのログインCookieではなく、専用のBearerトークンで認証する
// (ブラウザセッションを持たない自動化エージェントから叩くため)。
// 常にpublishedAt: nullの下書きとして作成し、このエンドポイント自体には
// 公開権限を持たせない(公開は必ず人間のモデレーターがUIから行う)。
// kind=INCIDENT(炎上案件・裏取り必須)を書く既存エージェントと、
// kind=JUDGMENT(行為判定・裏取り不要)を書く別エージェントの両方が叩く共通API。

const articleSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(20000),
    kind: z.enum(ArticleKind).default("INCIDENT"),
    incidentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "incidentDateはYYYY-MM-DD形式で指定してください。")
      .optional(),
    severity: z.enum(ArticleSeverity).optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind !== "INCIDENT") return;
    if (!data.incidentDate) {
      ctx.addIssue({ code: "custom", path: ["incidentDate"], message: "kind=INCIDENTにはincidentDateが必須です。" });
    }
    if (!data.severity) {
      ctx.addIssue({ code: "custom", path: ["severity"], message: "kind=INCIDENTにはseverityが必須です。" });
    }
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
// あわせてタグ(ジャンル)別のPV実績を返し、エージェントが「次にどのジャンルを
// 試すか」を過去実績から試行錯誤できるようにする(scripts/sync-article-pageviews.ts
// がGA4実測値でpageViewsを定期更新している)。genreStatsはINCIDENT(炎上案件)、
// judgmentGenreStatsはJUDGMENT(行為判定)のジャンル実績で、互いのPVで
// 相手側のジャンル判断が歪まないよう完全に分けて集計する。
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
      pageViews: true,
      kind: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // PVは公開されてから読まれた分の実績なので、下書きを含めるとタグ実績が
  // 薄まってしまう(下書きは常にpageViews=0)。公開済み記事のみで集計する。
  const publishedArticles = articles.filter((a) => a.publishedAt !== null);
  const genreStats = computeTagStats(publishedArticles.filter((a) => a.kind === "INCIDENT"));
  const judgmentGenreStats = computeTagStats(
    publishedArticles.filter((a) => a.kind === "JUDGMENT"),
  );

  return NextResponse.json({ articles, genreStats, judgmentGenreStats });
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

  const isIncident = parsed.data.kind === "INCIDENT";
  const article = await prisma.article.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      tags: parsed.data.tags ?? [],
      kind: parsed.data.kind,
      incidentDate: isIncident ? new Date(parsed.data.incidentDate!) : null,
      severity: isIncident ? parsed.data.severity! : null,
      moderatorId: moderator.id,
      // publishedAtは常にnull(下書き)。このAPIには公開権限を持たせない。
    },
  });

  return NextResponse.json(
    { ok: true, articleId: article.id, editUrl: `/moderator/articles/${article.id}` },
    { status: 201 },
  );
}
