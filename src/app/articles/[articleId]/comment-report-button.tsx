"use client";

import { useState } from "react";

export function CommentReportButton({
  articleId,
  commentId,
}: {
  articleId: string;
  commentId: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/comments/${commentId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "送信に失敗しました。");
        return;
      }
      setDone(true);
      setShowForm(false);
    } catch {
      setError("通信に失敗しました。しばらくしてから再度お試しください。");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.8rem" }}>
        通報済みです
      </p>
    );
  }

  if (!showForm) {
    return (
      <button
        type="button"
        className="btn btn-secondary vote-btn"
        style={{ marginTop: "0.35rem", fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
        onClick={() => setShowForm(true)}
      >
        通報
      </button>
    );
  }

  return (
    <div style={{ marginTop: "0.35rem" }}>
      <div className="form-field">
        <label htmlFor={`comment-report-reason-${commentId}`}>通報理由</label>
        <textarea
          id={`comment-report-reason-${commentId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="例: 誹謗中傷・個人情報の記載 等"
        />
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          className="btn"
          type="button"
          onClick={submit}
          disabled={pending || reason.trim().length < 3}
        >
          {pending ? "送信中…" : "通報する"}
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
