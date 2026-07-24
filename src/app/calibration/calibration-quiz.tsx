"use client";

import { useState } from "react";
import {
  CALIBRATION_SCENARIOS,
  CALIBRATION_SCALE_LABELS,
  type CalibrationScore,
} from "@/lib/calibrationScenarios";
import type { ScenarioAverage, CalibrationOverview } from "@/lib/calibrationStats";

const SCALE: CalibrationScore[] = [1, 2, 3, 4, 5];

type SubmitResult = {
  stats: ScenarioAverage[];
  overview: CalibrationOverview;
};

export function CalibrationQuiz() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<string, CalibrationScore>>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scenario = CALIBRATION_SCENARIOS[stepIndex];
  const total = CALIBRATION_SCENARIOS.length;
  const isLast = stepIndex === total - 1;
  const currentScore = answers[scenario.key];

  function selectScore(score: CalibrationScore) {
    setAnswers((prev) => ({ ...prev, [scenario.key]: score }));
  }

  async function handleNext() {
    if (currentScore === undefined) return;
    if (!isLast) {
      setStepIndex((i) => i + 1);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/calibration/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: CALIBRATION_SCENARIOS.map((s) => ({
            scenarioKey: s.key,
            score: answers[s.key],
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "送信に失敗しました。");
        return;
      }
      setResult({ stats: data.stats, overview: data.overview });
    } catch {
      setError("通信に失敗しました。しばらくしてから再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }

  if (result) {
    return (
      <CalibrationResult answers={answers as Record<string, CalibrationScore>} result={result} />
    );
  }

  return (
    <div className="card">
      <div className="calibration-progress-track">
        <div
          className="calibration-progress-fill"
          style={{ width: `${((stepIndex + 1) / total) * 100}%` }}
        />
      </div>
      <p className="muted" style={{ marginBottom: "0.75rem" }}>
        {stepIndex + 1} / {total}問
      </p>

      <h3 style={{ marginBottom: "0.5rem" }}>{scenario.title}</h3>
      <p style={{ marginBottom: "1.25rem" }}>{scenario.situation}</p>

      <div className="calibration-scale">
        {SCALE.map((score) => (
          <button
            key={score}
            type="button"
            className={`calibration-scale-option${currentScore === score ? " active" : ""}`}
            onClick={() => selectScore(score)}
          >
            {CALIBRATION_SCALE_LABELS[score]}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="form-actions" style={{ marginTop: "1.25rem" }}>
        {stepIndex > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleBack}
            disabled={submitting}
          >
            戻る
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={handleNext}
          disabled={currentScore === undefined || submitting}
        >
          {submitting ? "送信中…" : isLast ? "結果を見る" : "次へ"}
        </button>
      </div>
    </div>
  );
}

function CalibrationResult({
  answers,
  result,
}: {
  answers: Record<string, CalibrationScore>;
  result: SubmitResult;
}) {
  const yourScores = Object.values(answers);
  const yourAverage = yourScores.reduce((a, b) => a + b, 0) / yourScores.length;
  const communityAverage = result.overview.overallAverage;
  const diff = communityAverage !== null ? yourAverage - communityAverage : null;

  const tendencyText =
    diff === null
      ? "まだ全体の参考データが十分ではありません。"
      : diff <= -0.4
        ? "あなたの判定は全体よりやや厳しめ(違反寄り)です。"
        : diff >= 0.4
          ? "あなたの判定は全体よりやや緩め(問題なし寄り)です。"
          : "あなたの判定はおおむね全体の平均に近い基準です。";

  function pct(score: number) {
    return ((score - 1) / 4) * 100;
  }

  return (
    <div>
      <div className="card" style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <p className="stat-card-icon">🧭</p>
        <p className="stat-card-value">{yourAverage.toFixed(1)}</p>
        <p className="muted">あなたの平均スコア(1=違反 〜 5=問題なし)</p>
        <p style={{ marginTop: "0.75rem" }}>{tendencyText}</p>
        <p className="muted" style={{ marginTop: "0.25rem" }}>
          全体平均: {communityAverage !== null ? communityAverage.toFixed(1) : "-"} (受験者数{" "}
          {result.overview.attemptCount}人)
        </p>
      </div>

      <h2 style={{ marginBottom: "0.75rem" }}>シナリオ別の回答</h2>
      {CALIBRATION_SCENARIOS.map((scenario) => {
        const yourScore = answers[scenario.key];
        const stat = result.stats.find((s) => s.key === scenario.key);
        const communityAvg = stat?.average ?? null;
        return (
          <div className="card calibration-result-card" key={scenario.key}>
            <p style={{ fontWeight: 600, marginBottom: "0.35rem" }}>{scenario.title}</p>
            <div className="calibration-compare-track">
              {communityAvg !== null && (
                <div
                  className="calibration-compare-fill"
                  style={{ width: `${pct(communityAvg)}%` }}
                />
              )}
              <div className="calibration-compare-marker" style={{ left: `${pct(yourScore)}%` }} />
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

      <p className="muted" style={{ marginTop: "1rem" }}>
        次回の受験は24時間後から可能です。
      </p>
    </div>
  );
}
