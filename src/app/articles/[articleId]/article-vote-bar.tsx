"use client";

import { useEffect, useState } from "react";
import { CALIBRATION_SCALE_LABELS, type CalibrationScore } from "@/lib/calibrationScenarios";
import type { ArticleKind } from "@/generated/prisma";
import { VoteRateBar } from "../vote-rate-bar";

const SCALE: CalibrationScore[] = [1, 2, 3, 4, 5];

type ScoreCounts = Record<number, number>;

const QUESTION_LABELS: Record<ArticleKind, string> = {
  INCIDENT: "この記事は違反だと思いますか?",
  JUDGMENT: "この行為はトロールだと思いますか?",
};

export function ArticleVoteBar({
  articleId,
  kind,
  pageUrl,
  initialScoreCounts,
  initialMyVote,
}: {
  articleId: string;
  kind: ArticleKind;
  pageUrl: string;
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

  // Xのシェアリンク(?vote=1 / ?vote=5)から遷移してきた場合、自動でその側に投票する。
  // vote()は「同じ値をもう一度選ぶと取り消し」という通常のトグル仕様のため、既に
  // 同じ側へ投票済みなら何もしない(リンクを踏み直すたびに投票が消えるのを防ぐ)。
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("vote");
    const score = raw ? Number(raw) : null;
    if (score !== 1 && score !== 5) return;
    if (myVote === score) return;

    // vote()はsetState(setPending等)を呼ぶため、エフェクト本体から直接同期的に
    // 呼ばず、setTimeoutで次のタスクに逃がす(react-hooks/set-state-in-effect対策)。
    const timer = setTimeout(() => vote(score as CalibrationScore), 0);

    params.delete("vote");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);

    return () => clearTimeout(timer);
    // 初回マウント時のURL読み取りのみを意図しており、myVote変化に反応して再実行する必要はない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = SCALE.reduce((sum, s) => sum + (scoreCounts[s] ?? 0), 0);

  function xIntentUrl(score: 1 | 5, text: string): string {
    const intent = new URL("https://twitter.com/intent/tweet");
    intent.searchParams.set("text", text);
    intent.searchParams.set("url", `${pageUrl}?vote=${score}`);
    return intent.toString();
  }

  return (
    <div className="section">
      <h2>{QUESTION_LABELS[kind]}</h2>
      <p className="muted" style={{ marginTop: "0.35rem", marginBottom: "0.75rem" }}>
        判定基準診断と同じ1〜5段階で読者の意見を集計する参考シグナルです(モデレーター評価ではありません)。
      </p>

      <VoteRateBar scoreCounts={scoreCounts} />
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
        <a
          className="btn btn-secondary"
          href={xIntentUrl(1, "違反だと思う")}
          target="_blank"
          rel="noopener noreferrer"
        >
          🚫 違反だと思う→Xでポスト
        </a>
        <a
          className="btn btn-secondary"
          href={xIntentUrl(5, "問題なしだと思う")}
          target="_blank"
          rel="noopener noreferrer"
        >
          ✅ 問題なしだと思う→Xでポスト
        </a>
      </div>
      <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.75rem" }}>
        このリンクを踏んで戻ってきた人は自動的にその側へ投票されます。
      </p>
    </div>
  );
}
