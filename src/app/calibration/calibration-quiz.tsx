"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CALIBRATION_SCENARIOS,
  CALIBRATION_SCALE_LABELS,
  type CalibrationScore,
} from "@/lib/calibrationScenarios";

const SCALE: CalibrationScore[] = [1, 2, 3, 4, 5];

export function CalibrationQuiz() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<string, CalibrationScore>>>({});
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
        setSubmitting(false);
        return;
      }
      router.push(`/calibration/result/${data.attemptId}`);
    } catch {
      setError("通信に失敗しました。しばらくしてから再度お試しください。");
      setSubmitting(false);
    }
  }

  function handleBack() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
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
