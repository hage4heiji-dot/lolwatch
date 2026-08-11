"use client";

import { useState } from "react";
import { CommentReportButton } from "./comment-report-button";

interface CommentItem {
  id: string;
  body: string;
  createdAtLabel: string;
}

export function CommentSection({
  articleId,
  initialComments,
}: {
  articleId: string;
  initialComments: CommentItem[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (pending || body.trim().length === 0) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "送信に失敗しました。");
        return;
      }
      setComments((prev) => [
        ...prev,
        {
          id: data.comment.id,
          body: data.comment.body,
          createdAtLabel: "たった今",
        },
      ]);
      setBody("");
    } catch {
      setError("通信に失敗しました。しばらくしてから再度お試しください。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h2>コメント({comments.length}件)</h2>

      {comments.length === 0 ? (
        <p className="muted" style={{ marginTop: "0.5rem" }}>まだコメントはありません。</p>
      ) : (
        <div>
          {comments.map((comment) => (
            <div
              key={comment.id}
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: "0.75rem",
                marginTop: "0.75rem",
              }}
            >
              <p style={{ whiteSpace: "pre-wrap" }}>{comment.body}</p>
              <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.85rem" }}>
                {comment.createdAtLabel}
              </p>
              <CommentReportButton articleId={articleId} commentId={comment.id} />
            </div>
          ))}
        </div>
      )}

      <div className="form-field" style={{ marginTop: "1.5rem" }}>
        <label htmlFor="new-comment">コメントする</label>
        <textarea
          id="new-comment"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="コメントを入力(ログイン不要・投稿後の削除はできません)"
        />
      </div>
      <button className="btn" type="button" onClick={submit} disabled={pending || body.trim().length === 0}>
        {pending ? "投稿中…" : "投稿する"}
      </button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
