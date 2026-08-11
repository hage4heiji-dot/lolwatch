"use client";

import { useActionState } from "react";
import {
  publishArticleAction,
  unpublishArticleAction,
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
  const publishAction = publishArticleAction.bind(null, articleId);
  const unpublishAction = unpublishArticleAction.bind(null, articleId);
  const [publishState, publishFormAction, publishPending] = useActionState(
    publishAction,
    initialState,
  );
  const [unpublishState, unpublishFormAction, unpublishPending] = useActionState(
    unpublishAction,
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
    </div>
  );
}
