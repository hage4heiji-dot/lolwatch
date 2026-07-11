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

  const player = await prisma.player.findUnique({ where: { puuid } });
  if (!player) {
    return { error: "対象のプレイヤーが見つかりません。" };
  }

  await prisma.moderatorReview.create({
    data: {
      playerId: player.id,
      moderatorId: moderator.id,
      verdict: parsed.data.verdict,
      rationale: parsed.data.rationale,
    },
  });

  redirect(`/players/${puuid}`);
}
