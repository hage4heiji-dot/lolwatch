"use client";

import { useState } from "react";

export function ReportDeletionRequestButton({
  reportId,
  initialCount,
  initialHasRequested,
}: {
  reportId: string;
  initialCount: number;
  initialHasRequested: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [hasRequested, setHasRequested] = useState(initialHasRequested);
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/deletion-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "送信に失敗しました。");
        return;
      }
      setCount(data.requestCount);
      setHasRequested(true);
      setShowForm(false);
    } catch {
      setError("通信に失敗しました。しばらくしてから再度お試しください。");
    } finally {
      setPending(false);
    }
  }

  if (hasRequested) {
    return (
      <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
        削除を申請済みです{count > 0 ? `(${count}件)` : ""}
      </p>
    );
  }

  if (!showForm) {
    return (
      <button
        type="button"
        className="btn btn-secondary vote-btn"
        style={{ marginTop: "0.5rem", fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
        onClick={() => setShowForm(true)}
      >
        削除を申請{count > 0 ? ` (${count})` : ""}
      </button>
    );
  }

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <div className="form-field">
        <label htmlFor={`deletion-reason-${reportId}`}>削除申請の理由</label>
        <textarea
          id={`deletion-reason-${reportId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="例: 対象アカウントが違う、内容が事実と異なる 等"
        />
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          className="btn"
          type="button"
          onClick={submit}
          disabled={pending || reason.trim().length < 3}
        >
          {pending ? "送信中…" : "申請する"}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => setShowForm(false)}
          disabled={pending}
        >
          キャンセル
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
