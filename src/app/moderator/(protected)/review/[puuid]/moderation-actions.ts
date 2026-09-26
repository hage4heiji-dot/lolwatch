"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModerator } from "@/lib/moderatorAuth";
import { DISCORD_COLORS, SITE_URL, discordQuote, notifyDiscord } from "@/lib/discord";

export type ModerationFormState = { error?: string };

const hideSchema = z.object({ reason: z.string().trim().min(3).max(200) });

async function findOwnedReport(reportId: string, puuid: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { player: { select: { puuid: true } } },
  });
  if (!report || report.player.puuid !== puuid) return null;
  return report;
}

export async function hideReportAction(
  reportId: string,
  puuid: string,
  _prevState: ModerationFormState,
  formData: FormData,
): Promise<ModerationFormState> {
  const moderator = await requireModerator();
  if (!moderator.isAdmin) {
    return { error: "この操作には管理者権限が必要です。" };
  }

  const parsed = hideSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { error: "非表示理由を3文字以上で入力してください。" };
  }

  const report = await findOwnedReport(reportId, puuid);
  if (!report) {
    return { error: "対象の通報が見つかりません。" };
  }

  await prisma.report.update({
    where: { id: reportId },
    data: { hiddenAt: new Date(), hiddenReason: parsed.data.reason },
  });

  redirect(`/moderator/review/${puuid}`);
}

export async function unhideReportAction(
  reportId: string,
  puuid: string,
  _prevState: ModerationFormState,
  _formData: FormData,
): Promise<ModerationFormState> {
  const moderator = await requireModerator();
  if (!moderator.isAdmin) {
    return { error: "この操作には管理者権限が必要です。" };
  }

  const report = await findOwnedReport(reportId, puuid);
  if (!report) {
    return { error: "対象の通報が見つかりません。" };
  }

  await prisma.report.update({
    where: { id: reportId },
    data: { hiddenAt: null, hiddenReason: null },
  });

  redirect(`/moderator/review/${puuid}`);
}

// 判定へのコメントの非表示化。記事コメント(hideCommentAction)と同じく管理者権限を必須とする。
async function findOwnedReviewComment(commentId: string, puuid: string) {
  const comment = await prisma.reviewComment.findUnique({
    where: { id: commentId },
    include: {
      moderatorReview: {
        select: { report: { select: { player: { select: { puuid: true } } } } },
      },
    },
  });
  if (!comment || comment.moderatorReview.report.player.puuid !== puuid) return null;
  return comment;
}

export async function hideReviewCommentAction(
  commentId: string,
  puuid: string,
  _prevState: ModerationFormState,
  formData: FormData,
): Promise<ModerationFormState> {
  const moderator = await requireModerator();
  if (!moderator.isAdmin) {
    return { error: "この操作には管理者権限が必要です。" };
  }

  const parsed = hideSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { error: "非表示理由を3文字以上で入力してください。" };
  }

  const comment = await findOwnedReviewComment(commentId, puuid);
  if (!comment) {
    return { error: "対象のコメントが見つかりません。" };
  }

  await prisma.reviewComment.update({
    where: { id: commentId },
    data: { hiddenAt: new Date(), hiddenReason: parsed.data.reason },
  });

  redirect(`/moderator/review/${puuid}`);
}

export async function unhideReviewCommentAction(
  commentId: string,
  puuid: string,
  _prevState: ModerationFormState,
  _formData: FormData,
): Promise<ModerationFormState> {
  const moderator = await requireModerator();
  if (!moderator.isAdmin) {
    return { error: "この操作には管理者権限が必要です。" };
  }

  const comment = await findOwnedReviewComment(commentId, puuid);
  if (!comment) {
    return { error: "対象のコメントが見つかりません。" };
  }

  await prisma.reviewComment.update({
    where: { id: commentId },
    data: { hiddenAt: null, hiddenReason: null },
  });

  redirect(`/moderator/review/${puuid}`);
}

const replySchema = z.object({ body: z.string().trim().min(1).max(1000) });

// 判定へのコメントにモデレーターとして返信する。非表示化と違い、管理者でなくても
// ログイン済みのモデレーターなら誰でも返信できる。返信先は一般ユーザーのコメントのみ(1階層)。
export async function replyToReviewCommentAction(
  commentId: string,
  puuid: string,
  _prevState: ModerationFormState,
  formData: FormData,
): Promise<ModerationFormState> {
  const moderator = await requireModerator();

  const parsed = replySchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { error: "返信は1〜1000文字で入力してください。" };
  }

  const parent = await findOwnedReviewComment(commentId, puuid);
  if (!parent) {
    return { error: "対象のコメントが見つかりません。" };
  }
  if (parent.parentId || parent.moderatorId) {
    return { error: "モデレーターの返信にはさらに返信できません。" };
  }
  if (parent.hiddenAt) {
    return { error: "非表示にしたコメントには返信できません。" };
  }

  await prisma.reviewComment.create({
    data: {
      moderatorReviewId: parent.moderatorReviewId,
      parentId: parent.id,
      moderatorId: moderator.id,
      body: parsed.data.body,
    },
  });

  after(() =>
    notifyDiscord("activity", {
      label: "↩️ モデレーターの返信",
      title: `${moderator.displayName} が判定コメントに返信`,
      url: `${SITE_URL}/players/${encodeURIComponent(puuid)}`,
      color: DISCORD_COLORS.blue,
      fields: [
        { name: "元のコメント", value: discordQuote(parent.body) },
        { name: "返信", value: discordQuote(parsed.data.body) },
      ],
    }),
  );

  redirect(`/moderator/review/${puuid}`);
}
