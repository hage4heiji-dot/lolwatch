"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  publishArticleAction,
  unpublishArticleAction,
  archiveArticleAction,
  unarchiveArticleAction,
  deleteArticleAction,
  type ArticleFormState,
} from "../actions";

const initialState: ArticleFormState = {};

function DeleteControl({ deleteFormAction, deletePending, deleteError, label }: {
  deleteFormAction: (formData: FormData) => void;
  deletePending: boolean;
  deleteError?: string;
  label: string;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div style={{ marginTop: "0.5rem" }}>
      {confirming ? (
        <form action={deleteFormAction} style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-secondary vote-btn" type="submit" disabled={deletePending}>
            {deletePending ? "削除中…" : "本当に削除する"}
          </button>
          <button
            className="btn btn-secondary vote-btn"
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deletePending}
          >
            キャンセル
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="btn btn-secondary vote-btn"
          onClick={() => setConfirming(true)}
        >
          {label}
        </button>
      )}
      {deleteError && <p className="error-text">{deleteError}</p>}
    </div>
  );
}

export function PublishControl({
  articleId,
  publishedAt,
  archivedAt,
}: {
  articleId: string;
  publishedAt: string | null;
  archivedAt: string | null;
}) {
  const publishAction = publishArticleAction.bind(null, articleId);
  const unpublishAction = unpublishArticleAction.bind(null, articleId);
  const archiveAction = archiveArticleAction.bind(null, articleId);
  const unarchiveAction = unarchiveArticleAction.bind(null, articleId);
  const deleteAction = deleteArticleAction.bind(null, articleId);
  const [publishState, publishFormAction, publishPending] = useActionState(
    publishAction,
    initialState,
  );
  const [unpublishState, unpublishFormAction, unpublishPending] = useActionState(
    unpublishAction,
    initialState,
  );
  const [archiveState, archiveFormAction, archivePending] = useActionState(
    archiveAction,
    initialState,
  );
  const [unarchiveState, unarchiveFormAction, unarchivePending] = useActionState(
    unarchiveAction,
    initialState,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteAction,
    initialState,
  );

  if (publishedAt) {
    return (
      <div>
        <span className="badge badge-verified">🌐 公開中</span>
        <form action={unpublishFormAction} style={{ marginTop: "0.5rem" }}>
          <button className="btn btn-secondary" type="submit" disabled={unpublishPending}>
            {unpublishPending ? "処理中…" : "下書きに戻す"}
          </button>
        </form>
        {unpublishState.error && <p className="error-text">{unpublishState.error}</p>}
      </div>
    );
  }

  if (archivedAt) {
    return (
      <div>
        <span className="badge">🗄️ 非公開(重複など・確認不要)</span>
        <form action={unarchiveFormAction} style={{ marginTop: "0.5rem" }}>
          <button className="btn btn-secondary" type="submit" disabled={unarchivePending}>
            {unarchivePending ? "処理中…" : "下書きに戻す"}
          </button>
        </form>
        {unarchiveState.error && <p className="error-text">{unarchiveState.error}</p>}

        <DeleteControl
          deleteFormAction={deleteFormAction}
          deletePending={deletePending}
          deleteError={deleteState.error}
          label="この記事を削除"
        />
      </div>
    );
  }

  return (
    <div>
      <span className="badge badge-unverified">⏳ 下書き(要確認)</span>
      <form action={publishFormAction} style={{ marginTop: "0.5rem" }}>
        <button className="btn" type="submit" disabled={publishPending}>
          {publishPending ? "処理中…" : "公開する"}
        </button>
      </form>
      {publishState.error && <p className="error-text">{publishState.error}</p>}

      <form action={archiveFormAction} style={{ marginTop: "0.5rem" }}>
        <button className="btn btn-secondary" type="submit" disabled={archivePending}>
          {archivePending ? "処理中…" : "重複などのため非公開にする"}
        </button>
      </form>
      {archiveState.error && <p className="error-text">{archiveState.error}</p>}

      <DeleteControl
        deleteFormAction={deleteFormAction}
        deletePending={deletePending}
        deleteError={deleteState.error}
        label="この下書きを削除"
      />
    </div>
  );
}
