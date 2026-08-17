"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createArticleAction, type ArticleFormState } from "../actions";
import { MarkdownEditorField } from "../markdown-editor-field";
import { SeverityGuide } from "../severity-guide";
import { SEVERITY_LABELS, SEVERITY_ORDER } from "@/lib/articleSeverity";
import { ARTICLE_KIND_LABELS, ARTICLE_KIND_ORDER } from "@/lib/articleKind";
import type { ArticleKind } from "@/generated/prisma";

const initialState: ArticleFormState = {};

function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ArticleCreateForm() {
  const [state, formAction, pending] = useActionState(createArticleAction, initialState);
  const [kind, setKind] = useState<ArticleKind>("INCIDENT");

  return (
    <form action={formAction}>
      <div className="form-field">
        <label htmlFor="kind">記事の種類</label>
        <select
          id="kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as ArticleKind)}
        >
          {ARTICLE_KIND_ORDER.map((k) => (
            <option key={k} value={k}>
              {ARTICLE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.85rem" }}>
          行為判定: 特定の実在案件の裏取りをせず、「ある行為はトロールか?」を問う記事。炎上日・炎上度合いは不要。
        </p>
      </div>

      <div className="form-field">
        <label htmlFor="title">タイトル</label>
        <input id="title" name="title" required maxLength={200} />
      </div>

      {kind === "INCIDENT" && (
        <>
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
          <SeverityGuide />
        </>
      )}

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
