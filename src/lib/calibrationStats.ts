import { prisma } from "@/lib/prisma";
import { CALIBRATION_SCENARIOS } from "@/lib/calibrationScenarios";

export type ScenarioAverage = {
  key: string;
  title: string;
  average: number | null;
  count: number;
};

// シナリオごとの平均スコア(1=違反〜5=問題なし)と回答数。
// まだ誰も回答していないシナリオはaverage: null, count: 0として返す。
export async function getCalibrationScenarioStats(): Promise<ScenarioAverage[]> {
  const grouped = await prisma.calibrationAnswer.groupBy({
    by: ["scenarioKey"],
    _avg: { score: true },
    _count: { _all: true },
  });
  const byKey = new Map(grouped.map((g) => [g.scenarioKey, g]));

  return CALIBRATION_SCENARIOS.map((scenario) => {
    const g = byKey.get(scenario.key);
    return {
      key: scenario.key,
      title: scenario.title,
      average: g?._avg.score ?? null,
      count: g?._count._all ?? 0,
    };
  });
}

export type CalibrationOverview = {
  attemptCount: number;
  overallAverage: number | null;
};

// 全シナリオ・全受験者を通じた総受験数と全体平均(「コミュニティ全体は厳しめか緩めか」の目安)。
export async function getCalibrationOverview(): Promise<CalibrationOverview> {
  const [attemptCount, aggregate] = await Promise.all([
    prisma.calibrationAttempt.count(),
    prisma.calibrationAnswer.aggregate({ _avg: { score: true } }),
  ]);
  return {
    attemptCount,
    overallAverage: aggregate._avg.score ?? null,
  };
}

export type CalibrationAttemptDetail = {
  id: string;
  createdAt: Date;
  // key: scenarioKey, value: score(1〜5)
  answersByKey: Map<string, number>;
};

// 結果ページ(/calibration/result/[attemptId])用。存在しないIDの場合はnullを返す。
export async function getCalibrationAttempt(
  attemptId: string,
): Promise<CalibrationAttemptDetail | null> {
  const attempt = await prisma.calibrationAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      createdAt: true,
      answers: { select: { scenarioKey: true, score: true } },
    },
  });
  if (!attempt) return null;

  return {
    id: attempt.id,
    createdAt: attempt.createdAt,
    answersByKey: new Map(attempt.answers.map((a) => [a.scenarioKey, a.score])),
  };
}

// 診断トップページで「前回の結果を見る」導線を出すための、同一deviceIdの最新受験ID。
export async function getLatestCalibrationAttemptIdForDevice(
  deviceId: string,
): Promise<string | null> {
  const attempt = await prisma.calibrationAttempt.findFirst({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return attempt?.id ?? null;
}

// 平均スコアの差から「厳しめ/緩め/平均的」の一言コメントを作る。
// 結果ページと(将来的な)埋め込み表示の両方で使う想定の共通ロジック。
export function describeCalibrationTendency(
  yourAverage: number,
  communityAverage: number | null,
): string {
  if (communityAverage === null) return "まだ全体の参考データが十分ではありません。";
  const diff = yourAverage - communityAverage;
  if (diff <= -0.4) return "あなたの判定は全体よりやや厳しめ(違反寄り)です。";
  if (diff >= 0.4) return "あなたの判定は全体よりやや緩め(問題なし寄り)です。";
  return "あなたの判定はおおむね全体の平均に近い基準です。";
}
