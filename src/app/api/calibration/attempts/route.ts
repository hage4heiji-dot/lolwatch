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
import { checkCalibrationRateLimit } from "@/lib/rateLimit";
import { CALIBRATION_SCENARIO_KEYS } from "@/lib/calibrationScenarios";
import { getCalibrationScenarioStats, getCalibrationOverview } from "@/lib/calibrationStats";

// 1回の受験で全シナリオにちょうど1回ずつ回答することを要求する
// (一部だけの回答や重複回答は平均値の集計を歪めるため受け付けない)。
const requestSchema = z.object({
  answers: z
    .array(
      z.object({
        scenarioKey: z.string(),
        score: z.number().int().min(1).max(5),
      }),
    )
    .length(CALIBRATION_SCENARIO_KEYS.length),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容が不正です。", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { answers } = parsed.data;
  const keys = answers.map((a) => a.scenarioKey);
  const uniqueKeys = new Set(keys);
  const isCompleteSet =
    uniqueKeys.size === CALIBRATION_SCENARIO_KEYS.length &&
    CALIBRATION_SCENARIO_KEYS.every((key) => uniqueKeys.has(key));
  if (!isCompleteSet) {
    return NextResponse.json({ error: "回答内容が不正です。" }, { status: 400 });
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

  const rateCheck = await checkCalibrationRateLimit({ deviceId, ip });
  if (!rateCheck.allowed) {
    return respond({ error: rateCheck.reason }, 429);
  }

  const attempt = await prisma.calibrationAttempt.create({
    data: {
      deviceId,
      posterIp: ip,
      answers: {
        createMany: {
          data: answers.map((a) => ({ scenarioKey: a.scenarioKey, score: a.score })),
        },
      },
    },
  });

  const [stats, overview] = await Promise.all([
    getCalibrationScenarioStats(),
    getCalibrationOverview(),
  ]);

  return respond({ ok: true, attemptId: attempt.id, stats, overview }, 201);
}
