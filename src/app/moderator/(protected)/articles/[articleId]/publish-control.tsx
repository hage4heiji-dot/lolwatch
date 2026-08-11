"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  publishArticleAction,
  unpublishArticleAction,
  deleteArticleAction,
  type ArticleFormState,
} from "../actions";

const initialState: ArticleFormState = {};

export function PublishControl({
  articleId,
  publishedAt,
}: {
  articleId: string;
  publishedAt: string | null;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const publishAction = publishArticleAction.bind(null, articleId);
  const unpublishAction = unpublishArticleAction.bind(null, articleId);
  const deleteAction = deleteArticleAction.bind(null, articleId);
  const [publishState, publishFormAction, publishPending] = useActionState(
    publishAction,
    initialState,
  );
  const [unpublishState, unpublishFormAction, unpublishPending] = useActionState(
    unpublishAction,
    initialState,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteAction,
    initialState,
  );

  if (publishedAt) {
    return (
      <div>
        <span className="badge">公開中</span>
        <form action={unpublishFormAction} style={{ marginTop: "0.5rem" }}>
          <button className="btn btn-secondary" type="submit" disabled={unpublishPending}>
            {unpublishPending ? "処理中…" : "非公開に戻す"}
          </button>
        </form>
        {unpublishState.error && <p className="error-text">{unpublishState.error}</p>}
      </div>
    );
  }

  return (
    <div>
      <span className="muted">下書き(非公開)</span>
      <form action={publishFormAction} style={{ marginTop: "0.5rem" }}>
        <button className="btn" type="submit" disabled={publishPending}>
          {publishPending ? "処理中…" : "公開する"}
        </button>
      </form>
      {publishState.error && <p className="error-text">{publishState.error}</p>}

      {confirmingDelete ? (
        <form action={deleteFormAction} style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-secondary vote-btn" type="submit" disabled={deletePending}>
            {deletePending ? "削除中…" : "本当に削除する"}
          </button>
          <button
            className="btn btn-secondary vote-btn"
            type="button"
            onClick={() => setConfirmingDelete(false)}
            disabled={deletePending}
          >
            キャンセル
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="btn btn-secondary vote-btn"
          style={{ marginTop: "0.5rem" }}
          onClick={() => setConfirmingDelete(true)}
        >
          この下書きを削除
        </button>
      )}
      {deleteState.error && <p className="error-text">{deleteState.error}</p>}
    </div>
  );
}
