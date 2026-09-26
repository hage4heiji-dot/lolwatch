"use client";

import { useState, type ReactNode } from "react";
import { CommentReportButton } from "@/app/comment-report-button";

interface ReviewCommentItem {
  id: string;
  body: string;
  createdAtLabel: string;
}

// 判定(ModeratorReview)ごとの公開コメント欄。プレイヤーページには判定が複数並ぶため、
// 普段は「コメント(n)」ボタンだけを出し、開いたときに一覧と投稿フォームを表示する。
// children には同じ行に並べるボタン(「この判定に異議あり」)を渡す。
export function ReviewCommentSection({
  reviewId,
  initialComments,
  children,
}: {
  reviewId: string;
  initialComments: ReviewCommentItem[];
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (pending || body.trim().length === 0) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/moderator-reviews/${reviewId}/comments`, {
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
        { id: data.comment.id, body: data.comment.body, createdAtLabel: "たった今" },
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-end" }}>
        {children}
        <button
          type="button"
          className="btn btn-secondary vote-btn"
          style={{ marginTop: "0.5rem", fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          💬 コメント{comments.length > 0 ? ` (${comments.length})` : ""}
        </button>
      </div>

      {open && (
        <div
          style={{
            marginTop: "0.75rem",
            paddingLeft: "0.75rem",
            borderLeft: "2px solid var(--border)",
          }}
        >
          {comments.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              まだコメントはありません。
            </p>
          ) : (
            comments.map((comment, i) => (
              <div
                key={comment.id}
                style={{
                  borderTop: i === 0 ? undefined : "1px solid var(--border)",
                  paddingTop: i === 0 ? undefined : "0.6rem",
                  marginTop: i === 0 ? undefined : "0.6rem",
                }}
              >
                <p style={{ whiteSpace: "pre-wrap" }}>{comment.body}</p>
                <p className="muted" style={{ marginTop: "0.25rem", fontSize: "0.8rem" }}>
                  {comment.createdAtLabel}
                </p>
                <CommentReportButton
                  endpoint={`/api/moderator-reviews/${reviewId}/comments/${comment.id}/report`}
                  commentId={comment.id}
                />
              </div>
            ))
          )}

          <div className="form-field" style={{ marginTop: "1rem" }}>
            <label htmlFor={`new-review-comment-${reviewId}`}>この判定にコメントする</label>
            <textarea
              id={`new-review-comment-${reviewId}`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="コメントを入力(ログイン不要・投稿後の削除はできません)"
            />
          </div>
          <button
            className="btn"
            type="button"
            onClick={submit}
            disabled={pending || body.trim().length === 0}
          >
            {pending ? "投稿中…" : "投稿する"}
          </button>
          {error && <p className="error-text">{error}</p>}
        </div>
      )}
    </div>
  );
}
