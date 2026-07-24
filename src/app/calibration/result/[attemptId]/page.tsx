import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CALIBRATION_SCENARIOS,
  CALIBRATION_SCALE_LABELS,
  type CalibrationScore,
} from "@/lib/calibrationScenarios";
import {
  getCalibrationAttempt,
  getCalibrationScenarioStats,
  getCalibrationOverview,
  describeCalibrationTendency,
} from "@/lib/calibrationStats";
import { getCalibrationAnimalResult } from "@/lib/calibrationAnimalDiagnosis";
import { ShareButtons } from "@/app/share-buttons";

const SITE_URL = "https://lol-watch.com";

// 集計はDBの最新状態を反映する必要があるため、ビルド時の静的プリレンダー対象から外す。
export const dynamic = "force-dynamic";

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pct(score: number): number {
  return ((score - 1) / 4) * 100;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}): Promise<Metadata> {
  const { attemptId } = await params;
  const attempt = await getCalibrationAttempt(attemptId);
  if (!attempt) return { title: "判定基準診断の結果" };

  const yourAverage = average(Array.from(attempt.answersByKey.values()));
  const animalResult = getCalibrationAnimalResult(yourAverage);
  return {
    title: `判定基準診断の結果 | あなたは${animalResult.animal}タイプ`,
    description: `私の判定基準診断は「${animalResult.animal}タイプ(${animalResult.title})」、平均${yourAverage.toFixed(1)}(1=違反〜5=問題なし)でした。あなたも診断してみませんか?`,
  };
}

export default async function CalibrationResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const attempt = await getCalibrationAttempt(attemptId);
  if (!attempt) notFound();

  const [stats, overview] = await Promise.all([
    getCalibrationScenarioStats(),
    getCalibrationOverview(),
  ]);

  const yourAverage = average(Array.from(attempt.answersByKey.values()));
  const communityAverage = overview.overallAverage;
  const tendencyText = describeCalibrationTendency(yourAverage, communityAverage);
  const animalResult = getCalibrationAnimalResult(yourAverage);

  return (
    <div>
      <h1>判定基準診断の結果</h1>

      <div className="card calibration-animal-card">
        <p className="calibration-animal-emoji">{animalResult.emoji}</p>
        <p className="muted">あなたの判定基準は…</p>
        <p className="calibration-animal-title">
          {animalResult.animal}タイプ「{animalResult.title}」
        </p>
        <p style={{ marginTop: "0.5rem" }}>{animalResult.description}</p>
      </div>

      <div className="card" style={{ textAlign: "center", margin: "1rem 0 1.5rem" }}>
        <p className="stat-card-icon">🧭</p>
        <p className="stat-card-value">{yourAverage.toFixed(1)}</p>
        <p className="muted">あなたの平均スコア(1=違反 〜 5=問題なし)</p>
        <p style={{ marginTop: "0.75rem" }}>{tendencyText}</p>
        <p className="muted" style={{ marginTop: "0.25rem" }}>
          全体平均: {communityAverage !== null ? communityAverage.toFixed(1) : "-"} (受験者数{" "}
          {overview.attemptCount}人)
        </p>
      </div>

      <ShareButtons
        url={`${SITE_URL}/calibration/result/${attempt.id}`}
        text={`判定基準診断をやってみたら「${animalResult.animal}タイプ(${animalResult.title})」でした(平均${yourAverage.toFixed(1)})。あなたは何タイプ? | lolwatch`}
      />

      <section className="section">
        <h2>シナリオ別の回答</h2>
        {CALIBRATION_SCENARIOS.map((scenario) => {
          const yourScore = attempt.answersByKey.get(scenario.key) as CalibrationScore | undefined;
          if (yourScore === undefined) return null;
          const stat = stats.find((s) => s.key === scenario.key);
          const communityAvg = stat?.average ?? null;
          return (
            <div className="card calibration-result-card" key={scenario.key}>
              <p style={{ fontWeight: 600, marginBottom: "0.35rem" }}>{scenario.title}</p>
              <p className="muted" style={{ marginBottom: "0.5rem" }}>
                {scenario.situation}
              </p>
              <div className="calibration-compare-track">
                {communityAvg !== null && (
                  <div
                    className="calibration-compare-fill"
                    style={{ width: `${pct(communityAvg)}%` }}
                  />
                )}
                <div
                  className="calibration-compare-marker"
                  style={{ left: `${pct(yourScore)}%` }}
                />
              </div>
              <div className="calibration-compare-labels muted">
                <span>あなた: {CALIBRATION_SCALE_LABELS[yourScore]}</span>
                <span>
                  みんなの平均: {communityAvg !== null ? communityAvg.toFixed(1) : "-"}
                  {stat ? `(${stat.count}件)` : ""}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      <p className="muted" style={{ marginTop: "1.5rem" }}>
        <Link href="/calibration">判定基準診断トップに戻る</Link>(再受験は24時間に1回までです)
      </p>
    </div>
  );
}
