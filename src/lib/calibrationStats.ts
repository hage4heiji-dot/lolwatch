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
