import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readDeviceId } from "@/lib/deviceId";
import { canEditReport } from "@/lib/reportEdit";
import { ReportCategory } from "@/generated/prisma";
import { VIDEO_URL_MAX_LENGTH, isSafeVideoUrl } from "@/lib/videoUrl";

const patchSchema = z.object({
  category: z.enum(ReportCategory),
  incidentTimestampSeconds: z.number().int().min(0).max(4 * 60 * 60).optional().nullable(),
  comment: z.string().trim().max(300).optional().nullable(),
  videoUrl: z
    .string()
    .trim()
    .max(VIDEO_URL_MAX_LENGTH)
    .refine((v) => v === "" || isSafeVideoUrl(v), {
      message: "動画URLの形式が正しくありません(http/httpsのみ)。",
    })
    .optional()
    .nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
  const deviceId = readDeviceId(request);
  if (!deviceId) {
    return NextResponse.json({ error: "編集権限がありません。" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力内容が不正です。" }, { status: 400 });
  }

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) {
    return NextResponse.json({ error: "対象の通報が見つかりません。" }, { status: 404 });
  }
  if (
    !canEditReport({
      viewerDeviceId: deviceId,
      reportDeviceId: report.deviceId,
      createdAt: report.createdAt,
    })
  ) {
    return NextResponse.json(
      { error: "この通報は編集できません(投稿者本人による、投稿から1時間以内の編集のみ可能です)。" },
      { status: 403 },
    );
  }

  const updated = await prisma.report.update({
    where: { id: reportId },
    data: {
      category: parsed.data.category,
      incidentTimestampSeconds: parsed.data.incidentTimestampSeconds ?? null,
      comment: parsed.data.comment || null,
      videoUrl: parsed.data.videoUrl || null,
    },
  });

  return NextResponse.json({
    ok: true,
    category: updated.category,
    incidentTimestampSeconds: updated.incidentTimestampSeconds,
    comment: updated.comment,
    videoUrl: updated.videoUrl,
  });
}
