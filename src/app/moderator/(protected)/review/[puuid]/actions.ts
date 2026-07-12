"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModerator } from "@/lib/moderatorAuth";
import { ModeratorVerdict } from "@/generated/prisma";

export type ReviewFormState = { error?: string };

const reviewSchema = z.object({
  verdict: z.enum(ModeratorVerdict),
  rationale: z.string().trim().min(10).max(2000),
});

export async function submitReviewAction(
  reportId: string,
  puuid: string,
  _prevState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const moderator = await requireModerator();

  const parsed = reviewSchema.safeParse({
    verdict: formData.get("verdict"),
    rationale: formData.get("rationale"),
  });

  if (!parsed.success) {
    return { error: "入力内容を確認してください(判断理由は10文字以上必要です)。" };
  }

  // reportIdが本当にこのpuuidの通報かを確認してから評価を登録する。
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { player: { select: { puuid: true } } },
  });
  if (!report || report.player.puuid !== puuid) {
    return { error: "対象の通報が見つかりません。" };
  }

  await prisma.moderatorReview.create({
    data: {
      reportId: report.id,
      moderatorId: moderator.id,
      verdict: parsed.data.verdict,
      rationale: parsed.data.rationale,
    },
  });

  redirect(`/players/${puuid}`);
}

export async function editReviewAction(
  reviewId: string,
  puuid: string,
  _prevState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const moderator = await requireModerator();

  const parsed = reviewSchema.safeParse({
    verdict: formData.get("verdict"),
    rationale: formData.get("rationale"),
  });

  if (!parsed.success) {
    return { error: "入力内容を確認してください(判断理由は10文字以上必要です)。" };
  }

  const review = await prisma.moderatorReview.findUnique({ where: { id: reviewId } });
  if (!review) {
    return { error: "対象の評価が見つかりません。" };
  }
  // 投稿した本人のモデレーターのみ編集できる。
  if (review.moderatorId !== moderator.id) {
    return { error: "この評価は投稿した本人のみ編集できます。" };
  }

  await prisma.moderatorReview.update({
    where: { id: reviewId },
    data: {
      verdict: parsed.data.verdict,
      rationale: parsed.data.rationale,
    },
  });

  redirect(`/moderator/review/${puuid}`);
}
