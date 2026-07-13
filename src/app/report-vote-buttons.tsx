"use client";

import { useState } from "react";

type VoteType = "LIKE" | "DISLIKE";

export function ReportVoteButtons({
  reportId,
  initialLikeCount,
  initialDislikeCount,
  initialMyVote,
}: {
  reportId: string;
  initialLikeCount: number;
  initialDislikeCount: number;
  initialMyVote: VoteType | null;
}) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount);
  const [myVote, setMyVote] = useState(initialMyVote);
  const [pending, setPending] = useState(false);

  async function vote(voteType: VoteType) {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voteType }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setLikeCount(data.likeCount);
      setDislikeCount(data.dislikeCount);
      setMyVote(data.myVote);
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
      <button
        type="button"
        className={`btn btn-secondary vote-btn${myVote === "LIKE" ? " vote-btn-active-like" : ""}`}
        onClick={() => vote("LIKE")}
        disabled={pending}
        title="この通報の内容は妥当だと思う場合に押してください"
      >
        この通報は妥当 {likeCount}
      </button>
      <button
        type="button"
        className={`btn btn-secondary vote-btn${myVote === "DISLIKE" ? " vote-btn-active-dislike" : ""}`}
        onClick={() => vote("DISLIKE")}
        disabled={pending}
        title="この通報の内容は不当だと思う場合に押してください"
      >
        この通報は不当 {dislikeCount}
      </button>
    </div>
  );
}
