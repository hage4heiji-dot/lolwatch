"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModerator } from "@/lib/moderatorAuth";
import { ArticleSeverity, ArticleKind } from "@/generated/prisma";

export type ArticleFormState = { error?: string };
export type ModerationFormState = { error?: string };

// kind=INCIDENT(炎上案件)はincidentDate/severityが必須、kind=JUDGMENT(行為判定)は
// 特定の実在案件を指さないためどちらも持たない。フォーム側で送られてきても無視する。
const articleSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(20000),
    kind: z.enum(ArticleKind),
    // kind=JUDGMENTの場合、フォーム側で炎上日・炎上度合いの入力欄自体を描画しないため、
    // FormData.get()は「存在しないキー」としてundefinedではなくnullを返す。
    // z.string().optional()はundefinedのみ許容しnullを弾いてしまうため、
    // 必ずnullish()(null/undefined両方許容)にする。
    incidentDate: z.string().nullish(),
    severity: z.string().nullish(),
  })
  .superRefine((data, ctx) => {
    if (data.kind !== "INCIDENT") return;
    if (!data.incidentDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.incidentDate)) {
      ctx.addIssue({ code: "custom", path: ["incidentDate"], message: "炎上日の形式が不正です。" });
    }
    if (!data.severity || !z.enum(ArticleSeverity).safeParse(data.severity).success) {
      ctx.addIssue({ code: "custom", path: ["severity"], message: "炎上度合いを選択してください。" });
    }
  });

const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;

// カンマ区切りの自由入力タグを配列に変換する。空要素・重複・長すぎるタグは除外する。
function parseTagsInput(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0 && tag.length <= MAX_TAG_LENGTH);
  return Array.from(new Set(tags)).slice(0, MAX_TAGS);
}

// 記事本体の編集は投稿した本人のモデレーターか管理者のみ(ModeratorReviewの編集権限と同じ方針)。
async function findEditableArticle(articleId: string, moderatorId: string, isAdmin: boolean) {
  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) return null;
  if (article.moderatorId !== moderatorId && !isAdmin) return null;
  return article;
}

export async function createArticleAction(
  _prevState: ArticleFormState,
  formData: FormData,
): Promise<ArticleFormState> {
  const moderator = await requireModerator();

  const parsed = articleSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    kind: formData.get("kind"),
    incidentDate: formData.get("incidentDate"),
    severity: formData.get("severity"),
  });
  if (!parsed.success) {
    return { error: "入力内容を確認してください(タイトル・本文は必須、炎上案件の場合は炎上日・炎上度合いも必須です)。" };
  }

  const isIncident = parsed.data.kind === "INCIDENT";
  const article = await prisma.article.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      tags: parseTagsInput(formData.get("tags")),
      kind: parsed.data.kind,
      incidentDate: isIncident ? new Date(parsed.data.incidentDate!) : null,
      severity: isIncident ? (parsed.data.severity as ArticleSeverity) : null,
      moderatorId: moderator.id,
    },
  });

  redirect(`/moderator/articles/${article.id}`);
}

export async function updateArticleAction(
  articleId: string,
  _prevState: ArticleFormState,
  formData: FormData,
): Promise<ArticleFormState> {
  const moderator = await requireModerator();

  const parsed = articleSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    kind: formData.get("kind"),
    incidentDate: formData.get("incidentDate"),
    severity: formData.get("severity"),
  });
  if (!parsed.success) {
    return { error: "入力内容を確認してください(タイトル・本文は必須、炎上案件の場合は炎上日・炎上度合いも必須です)。" };
  }

  const article = await findEditableArticle(articleId, moderator.id, moderator.isAdmin);
  if (!article) {
    return { error: "対象の記事が見つかりません。" };
  }

  const isIncident = parsed.data.kind === "INCIDENT";
  await prisma.article.update({
    where: { id: articleId },
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      tags: parseTagsInput(formData.get("tags")),
      kind: parsed.data.kind,
      incidentDate: isIncident ? new Date(parsed.data.incidentDate!) : null,
      severity: isIncident ? (parsed.data.severity as ArticleSeverity) : null,
    },
  });

  redirect(`/moderator/articles/${articleId}`);
}

export async function publishArticleAction(
  articleId: string,
  _prevState: ArticleFormState,
  _formData: FormData,
): Promise<ArticleFormState> {
  const moderator = await requireModerator();

  const article = await findEditableArticle(articleId, moderator.id, moderator.isAdmin);
  if (!article) {
    return { error: "対象の記事が見つかりません。" };
  }

  await prisma.article.update({
    where: { id: articleId },
    // archivedAtも念のためクリアする(通常はarchivedAt≠nullの記事は下書きに
    // 戻してから公開する運用だが、状態の矛盾を残さないための保険)。
    data: { publishedAt: new Date(), archivedAt: null },
  });

  redirect(`/moderator/articles/${articleId}`);
}

export async function unpublishArticleAction(
  articleId: string,
  _prevState: ArticleFormState,
  _formData: FormData,
): Promise<ArticleFormState> {
  const moderator = await requireModerator();

  const article = await findEditableArticle(articleId, moderator.id, moderator.isAdmin);
  if (!article) {
    return { error: "対象の記事が見つかりません。" };
  }

  await prisma.article.update({
    where: { id: articleId },
    data: { publishedAt: null },
  });

  redirect(`/moderator/articles/${articleId}`);
}

// 重複記事など「確認不要」と判断した下書きを非公開にする。削除と違い、自動投稿API
// の既存記事一覧(重複防止用)には残り続けるため、AIが同じ案件を再度拾うのを防げる。
export async function archiveArticleAction(
  articleId: string,
  _prevState: ArticleFormState,
  _formData: FormData,
): Promise<ArticleFormState> {
  const moderator = await requireModerator();

  const article = await findEditableArticle(articleId, moderator.id, moderator.isAdmin);
  if (!article) {
    return { error: "対象の記事が見つかりません。" };
  }
  if (article.publishedAt) {
    return { error: "公開中の記事は非公開にできません。先に下書きに戻してください。" };
  }

  await prisma.article.update({
    where: { id: articleId },
    data: { archivedAt: new Date() },
  });

  redirect(`/moderator/articles/${articleId}`);
}

export async function unarchiveArticleAction(
  articleId: string,
  _prevState: ArticleFormState,
  _formData: FormData,
): Promise<ArticleFormState> {
  const moderator = await requireModerator();

  const article = await findEditableArticle(articleId, moderator.id, moderator.isAdmin);
  if (!article) {
    return { error: "対象の記事が見つかりません。" };
  }

  await prisma.article.update({
    where: { id: articleId },
    data: { archivedAt: null },
  });

  redirect(`/moderator/articles/${articleId}`);
}

// 下書き・非公開の記事のみ削除可能とする。公開済みの記事は読者のコメント・投票が
// 付いている可能性があるため、削除する前に一度下書きに戻すひと手間を挟む。
export async function deleteArticleAction(
  articleId: string,
  _prevState: ArticleFormState,
  _formData: FormData,
): Promise<ArticleFormState> {
  const moderator = await requireModerator();

  const article = await findEditableArticle(articleId, moderator.id, moderator.isAdmin);
  if (!article) {
    return { error: "対象の記事が見つかりません。" };
  }
  if (article.publishedAt) {
    return { error: "公開中の記事は削除できません。先に下書きに戻してください。" };
  }

  await prisma.article.delete({ where: { id: articleId } });

  redirect("/moderator/articles");
}

const hideCommentSchema = z.object({ reason: z.string().trim().min(3).max(200) });

// コメントの非表示化はReportのhideReportActionと同じく管理者権限を必須とする。
export async function hideCommentAction(
  commentId: string,
  articleId: string,
  _prevState: ModerationFormState,
  formData: FormData,
): Promise<ModerationFormState> {
  const moderator = await requireModerator();
  if (!moderator.isAdmin) {
    return { error: "この操作には管理者権限が必要です。" };
  }

  const parsed = hideCommentSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { error: "非表示理由を3文字以上で入力してください。" };
  }

  const comment = await prisma.articleComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.articleId !== articleId) {
    return { error: "対象のコメントが見つかりません。" };
  }

  await prisma.articleComment.update({
    where: { id: commentId },
    data: { hiddenAt: new Date(), hiddenReason: parsed.data.reason },
  });

  redirect(`/moderator/articles/${articleId}`);
}

export async function unhideCommentAction(
  commentId: string,
  articleId: string,
  _prevState: ModerationFormState,
  _formData: FormData,
): Promise<ModerationFormState> {
  const moderator = await requireModerator();
  if (!moderator.isAdmin) {
    return { error: "この操作には管理者権限が必要です。" };
  }

  const comment = await prisma.articleComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.articleId !== articleId) {
    return { error: "対象のコメントが見つかりません。" };
  }

  await prisma.articleComment.update({
    where: { id: commentId },
    data: { hiddenAt: null, hiddenReason: null },
  });

  redirect(`/moderator/articles/${articleId}`);
}
