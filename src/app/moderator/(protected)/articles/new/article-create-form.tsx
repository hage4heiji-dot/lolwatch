"use client";

import { useActionState } from "react";
import { createArticleAction, type ArticleFormState } from "../actions";
import { MarkdownEditorField } from "../markdown-editor-field";

const initialState: ArticleFormState = {};

export function ArticleCreateForm() {
  const [state, formAction, pending] = useActionState(createArticleAction, initialState);

  return (
    <form action={formAction}>
      <div className="form-field">
        <label htmlFor="title">タイトル</label>
        <input id="title" name="title" required maxLength={200} />
      </div>
      <MarkdownEditorField defaultValue="" />
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "作成中…" : "下書きを作成"}
      </button>
      {state.error && <p className="error-text">{state.error}</p>}
    </form>
  );
}
