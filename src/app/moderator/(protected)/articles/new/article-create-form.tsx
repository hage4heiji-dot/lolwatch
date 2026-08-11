"use client";

import { useActionState } from "react";
import { createArticleAction, type ArticleFormState } from "../actions";
import { MarkdownEditorField } from "../markdown-editor-field";
import { SEVERITY_LABELS, SEVERITY_ORDER } from "@/lib/articleSeverity";

const initialState: ArticleFormState = {};

function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ArticleCreateForm() {
  const [state, formAction, pending] = useActionState(createArticleAction, initialState);

  return (
    <form action={formAction}>
      <div className="form-field">
        <label htmlFor="title">タイトル</label>
        <input id="title" name="title" required maxLength={200} />
      </div>
      <div className="form-row">
        <div className="form-field">
          <label htmlFor="incidentDate">炎上日</label>
          <input
            type="date"
            id="incidentDate"
            name="incidentDate"
            required
            defaultValue={todayDateInputValue()}
          />
        </div>
        <div className="form-field">
          <label htmlFor="severity">炎上度合い</label>
          <select id="severity" name="severity" defaultValue="MEDIUM" required>
            {SEVERITY_ORDER.map((severity) => (
              <option key={severity} value={severity}>
                {SEVERITY_LABELS[severity]}
              </option>
            ))}
          </select>
        </div>
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
