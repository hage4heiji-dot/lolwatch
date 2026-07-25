import { prisma } from "@/lib/prisma";
import { CALIBRATION_SCENARIOS } from "@/lib/calibrationScenarios";
import {
  getCalibrationChampionResult,
  ALL_CALIBRATION_CHAMPION_RESULTS,
} from "@/lib/calibrationChampionDiagnosis";

// 集計系(シナリオ別平均・全体平均・タイプ別分布)は結果ページ(シェアされて
// 大量に閲覧される想定)を開くたびに毎回DBへ問い合わせるとアクセス集中時に重くなるため、
// 短時間キャッシュして使い回す(ddragonバージョンのキャッシュと同じ方針)。
const STATS_CACHE_TTL_MS = 30 * 1000;

function memoizeWithTtl<T>(fn: () => Promise<T>, ttlMs: number): () => Promise<T> {
  let cached: { value: T; fetchedAt: number } | null = null;
  return async () => {
    if (cached && Date.now() - cached.fetchedAt < ttlMs) {
      return cached.value;
    }
    const value = await fn();
    cached = { value, fetchedAt: Date.now() };
    return value;
  };
}

export type ScenarioAverage = {
  key: string;
  title: string;
  average: number | null;
  count: number;
};

// シナリオごとの平均スコア(1=違反〜5=問題なし)と回答数。
// まだ誰も回答していないシナリオはaverage: null, count: 0として返す。
async function computeCalibrationScenarioStats(): Promise<ScenarioAverage[]> {
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
export const getCalibrationScenarioStats = memoizeWithTtl(
  computeCalibrationScenarioStats,
  STATS_CACHE_TTL_MS,
);

export type CalibrationOverview = {
  attemptCount: number;
  overallAverage: number | null;
};

// 全シナリオ・全受験者を通じた総受験数と全体平均(「コミュニティ全体は厳しめか緩めか」の目安)。
async function computeCalibrationOverview(): Promise<CalibrationOverview> {
  const [attemptCount, aggregate] = await Promise.all([
    prisma.calibrationAttempt.count(),
    prisma.calibrationAnswer.aggregate({ _avg: { score: true } }),
  ]);
  return {
    attemptCount,
    overallAverage: aggregate._avg.score ?? null,
  };
}
export const getCalibrationOverview = memoizeWithTtl(computeCalibrationOverview, STATS_CACHE_TTL_MS);

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

export type ChampionTypeDistribution = {
  championName: string;
  count: number;
  // 受験者が誰もいない場合はnull(0%と区別する)。
  percentage: number | null;
};

// チャンピオンタイプ(getCalibrationChampionResult)はDBの列ではなく9問の回答から
// 都度計算する値のため、SQLのgroupByでは集計できない。受験数がまだ少ない前提で
// 全件をJSに読み込んで診断ロジックを再適用し、タイプ別の人数・割合を出す
// (全件スキャン+JS集計のため、これも上記のキャッシュ対象に含める)。
async function computeCalibrationChampionDistribution(): Promise<ChampionTypeDistribution[]> {
  const attempts = await prisma.calibrationAttempt.findMany({
    select: { answers: { select: { score: true } } },
  });

  const counts = new Map<string, number>(
    ALL_CALIBRATION_CHAMPION_RESULTS.map((c) => [c.championName, 0]),
  );
  for (const attempt of attempts) {
    const scores = attempt.answers.map((a) => a.score);
    if (scores.length === 0) continue;
    const champion = getCalibrationChampionResult(scores);
    counts.set(champion.championName, (counts.get(champion.championName) ?? 0) + 1);
  }

  const total = attempts.length;
  return ALL_CALIBRATION_CHAMPION_RESULTS.map((c) => {
    const count = counts.get(c.championName) ?? 0;
    return {
      championName: c.championName,
      count,
      percentage: total > 0 ? (count / total) * 100 : null,
    };
  });
}
export const getCalibrationChampionDistribution = memoizeWithTtl(
  computeCalibrationChampionDistribution,
  STATS_CACHE_TTL_MS,
);

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
