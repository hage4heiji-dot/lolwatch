"use client";

import { useActionState } from "react";
import { updateArticleAction, type ArticleFormState } from "../actions";
import { MarkdownEditorField } from "../markdown-editor-field";

const initialState: ArticleFormState = {};

export function ArticleEditForm({
  articleId,
  title,
  body,
  tags,
}: {
  articleId: string;
  title: string;
  body: string;
  tags: string[];
}) {
  const action = updateArticleAction.bind(null, articleId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <div className="form-field">
        <label htmlFor="title">タイトル</label>
        <input id="title" name="title" required maxLength={200} defaultValue={title} />
      </div>
      <div className="form-field">
        <label htmlFor="tags">タグ(カンマ区切り、最大10個)</label>
        <input
          id="tags"
          name="tags"
          maxLength={300}
          placeholder="例: AI関連, ペナルティ制度"
          defaultValue={tags.join(", ")}
        />
      </div>
      <MarkdownEditorField defaultValue={body} />
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "更新中…" : "更新する"}
      </button>
      {state.error && <p className="error-text">{state.error}</p>}
    </form>
  );
}
