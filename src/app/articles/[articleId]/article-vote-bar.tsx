"use client";

import { useState } from "react";
import { CALIBRATION_SCALE_LABELS, type CalibrationScore } from "@/lib/calibrationScenarios";

const SCALE: CalibrationScore[] = [1, 2, 3, 4, 5];

type ScoreCounts = Record<number, number>;

export function ArticleVoteBar({
  articleId,
  initialScoreCounts,
  initialMyVote,
}: {
  articleId: string;
  initialScoreCounts: ScoreCounts;
  initialMyVote: CalibrationScore | null;
}) {
  const [scoreCounts, setScoreCounts] = useState(initialScoreCounts);
  const [myVote, setMyVote] = useState(initialMyVote);
  const [pending, setPending] = useState(false);

  async function vote(score: CalibrationScore) {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setScoreCounts(data.scoreCounts);
      setMyVote(data.myVote);
    } finally {
      setPending(false);
    }
  }

  const total = SCALE.reduce((sum, s) => sum + (scoreCounts[s] ?? 0), 0);

  return (
    <div className="section">
      <h2>この記事は違反だと思いますか?</h2>
      <p className="muted" style={{ marginTop: "0.35rem", marginBottom: "0.75rem" }}>
        判定基準診断と同じ1〜5段階で読者の意見を集計する参考シグナルです(モデレーター評価ではありません)。
      </p>

      <div className="violation-bar-track">
        {SCALE.map((score) => {
          const count = scoreCounts[score] ?? 0;
          const percent = total === 0 ? 20 : (count / total) * 100;
          return (
            <div
              key={score}
              className={`violation-bar-segment-${score}`}
              style={{ width: `${percent}%` }}
              title={`${CALIBRATION_SCALE_LABELS[score]}: ${count}票`}
            />
          );
        })}
      </div>
      <div className="violation-bar-labels">
        <span>⚠️ 違反</span>
        <span>✅ 問題なし</span>
      </div>
      <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.8rem" }}>
        {total > 0 ? `${total}票` : "まだ投票はありません"}
      </p>

      <div className="calibration-scale" style={{ marginTop: "0.75rem" }}>
        {SCALE.map((score) => (
          <button
            key={score}
            type="button"
            className={`calibration-scale-option${myVote === score ? " active" : ""}`}
            onClick={() => vote(score)}
            disabled={pending}
          >
            {CALIBRATION_SCALE_LABELS[score]}
          </button>
        ))}
      </div>
    </div>
  );
}
