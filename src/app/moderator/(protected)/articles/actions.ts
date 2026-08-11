"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModerator } from "@/lib/moderatorAuth";
import { ArticleSeverity } from "@/generated/prisma";

export type ArticleFormState = { error?: string };
export type ModerationFormState = { error?: string };

const articleSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  incidentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "炎上日の形式が不正です。"),
  severity: z.enum(ArticleSeverity),
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
    incidentDate: formData.get("incidentDate"),
    severity: formData.get("severity"),
  });
  if (!parsed.success) {
    return { error: "タイトル・本文・炎上日・炎上度合いを入力してください。" };
  }

  const article = await prisma.article.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      tags: parseTagsInput(formData.get("tags")),
      incidentDate: new Date(parsed.data.incidentDate),
      severity: parsed.data.severity,
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
    incidentDate: formData.get("incidentDate"),
    severity: formData.get("severity"),
  });
  if (!parsed.success) {
    return { error: "タイトル・本文・炎上日・炎上度合いを入力してください。" };
  }

  const article = await findEditableArticle(articleId, moderator.id, moderator.isAdmin);
  if (!article) {
    return { error: "対象の記事が見つかりません。" };
  }

  await prisma.article.update({
    where: { id: articleId },
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      tags: parseTagsInput(formData.get("tags")),
      incidentDate: new Date(parsed.data.incidentDate),
      severity: parsed.data.severity,
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
    data: { publishedAt: new Date() },
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
