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
      <div className="form-field">
        <label htmlFor="tags">タグ(カンマ区切り、最大10個)</label>
        <input id="tags" name="tags" maxLength={300} placeholder="例: AI関連, ペナルティ制度" />
      </div>
      <MarkdownEditorField defaultValue="" />
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "作成中…" : "下書きを作成"}
      </button>
      {state.error && <p className="error-text">{state.error}</p>}
    </form>
  );
}
