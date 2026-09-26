"use client";

import { useState } from "react";
import { useActionState } from "react";
type ModerationFormState = { error?: string };
type ModerationAction = (
  prevState: ModerationFormState,
  formData: FormData,
) => Promise<ModerationFormState>;

const initialState: ModerationFormState = {};

// 記事コメント・判定コメント共通の非表示/再表示コントロール。対象ID等をbind済みの
// Server Actionを親(Server Component)から受け取る。
export function HideCommentControl({
  commentId,
  hideAction,
  unhideAction,
  hiddenAt,
  hiddenReason,
}: {
  commentId: string;
  hideAction: ModerationAction;
  unhideAction: ModerationAction;
  hiddenAt: string | null;
  hiddenReason: string | null;
}) {
  const [showForm, setShowForm] = useState(false);
  const [hideState, hideFormAction, hidePending] = useActionState(hideAction, initialState);
  const [unhideState, unhideFormAction, unhidePending] = useActionState(
    unhideAction,
    initialState,
  );

  if (hiddenAt) {
    return (
      <div style={{ marginTop: "0.35rem" }}>
        <span className="badge badge-verified-guilty">
          非表示中{hiddenReason ? `(理由: ${hiddenReason})` : ""}
        </span>
        <form action={unhideFormAction} style={{ marginTop: "0.35rem" }}>
          <button className="btn btn-secondary vote-btn" type="submit" disabled={unhidePending}>
            {unhidePending ? "処理中…" : "表示に戻す"}
          </button>
        </form>
        {unhideState.error && <p className="error-text">{unhideState.error}</p>}
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        type="button"
        className="btn btn-secondary vote-btn"
        style={{ marginTop: "0.35rem" }}
        onClick={() => setShowForm(true)}
      >
        このコメントを非表示にする
      </button>
    );
  }

  return (
    <form action={hideFormAction} style={{ marginTop: "0.35rem" }}>
      <div className="form-field">
        <label htmlFor={`hide-comment-reason-${commentId}`}>非表示理由</label>
        <input
          id={`hide-comment-reason-${commentId}`}
          name="reason"
          required
          minLength={3}
          maxLength={200}
        />
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="btn" type="submit" disabled={hidePending}>
          {hidePending ? "処理中…" : "非表示にする"}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => setShowForm(false)}
          disabled={hidePending}
        >
          キャンセル
        </button>
      </div>
      {hideState.error && <p className="error-text">{hideState.error}</p>}
    </form>
  );
}
