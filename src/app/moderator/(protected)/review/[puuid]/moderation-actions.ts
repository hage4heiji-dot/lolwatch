"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModerator } from "@/lib/moderatorAuth";

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
