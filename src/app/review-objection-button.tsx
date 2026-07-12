"use client";

import { useState } from "react";

export function ReviewObjectionButton({
  reviewId,
  initialCount,
  initialHasObjected,
}: {
  reviewId: string;
  initialCount: number;
  initialHasObjected: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [hasObjected, setHasObjected] = useState(initialHasObjected);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/moderator-reviews/${reviewId}/objection`, {
        method: "POST",
      });
      if (!res.ok) return;
      const data = await res.json();
      setCount(data.objectionCount);
      setHasObjected(data.hasObjected);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className={`btn btn-secondary vote-btn${hasObjected ? " vote-btn-active-dislike" : ""}`}
      style={{ marginTop: "0.5rem", fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
      onClick={toggle}
      disabled={pending}
    >
      この判定に異議あり{count > 0 ? ` (${count})` : ""}
    </button>
  );
}
