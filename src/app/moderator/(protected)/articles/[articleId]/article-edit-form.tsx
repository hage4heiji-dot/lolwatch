"use client";

import { useActionState } from "react";
import { updateArticleAction, type ArticleFormState } from "../actions";
import { MarkdownEditorField } from "../markdown-editor-field";

const initialState: ArticleFormState = {};

export function ArticleEditForm({
  articleId,
  title,
  body,
}: {
  articleId: string;
  title: string;
  body: string;
}) {
  const action = updateArticleAction.bind(null, articleId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <div className="form-field">
        <label htmlFor="title">タイトル</label>
        <input id="title" name="title" required maxLength={200} defaultValue={title} />
      </div>
      <MarkdownEditorField defaultValue={body} />
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "更新中…" : "更新する"}
      </button>
      {state.error && <p className="error-text">{state.error}</p>}
    </form>
  );
}
