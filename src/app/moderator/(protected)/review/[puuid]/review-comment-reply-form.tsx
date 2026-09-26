"use client";

import { useActionState, useState } from "react";
import { replyToReviewCommentAction, type ModerationFormState } from "./moderation-actions";

const initialState: ModerationFormState = {};

export function ReviewCommentReplyForm({ commentId, puuid }: { commentId: string; puuid: string }) {
  const [showForm, setShowForm] = useState(false);
  const action = replyToReviewCommentAction.bind(null, commentId, puuid);
  const [state, formAction, pending] = useActionState(action, initialState);
  const bodyId = `review-comment-reply-${commentId}`;

  if (!showForm) {
    return (
      <button
        type="button"
        className="btn btn-secondary vote-btn"
        style={{ marginTop: "0.35rem" }}
        onClick={() => setShowForm(true)}
      >
        ↩️ 返信する
      </button>
    );
  }

  return (
    <form action={formAction} style={{ marginTop: "0.35rem" }}>
      <div className="form-field">
        <label htmlFor={bodyId}>モデレーターとして返信(プレイヤーページに公開されます)</label>
        <textarea id={bodyId} name="body" rows={3} required maxLength={1000} />
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "送信中…" : "返信を公開する"}
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
      {state.error && <p className="error-text">{state.error}</p>}
    </form>
  );
}
