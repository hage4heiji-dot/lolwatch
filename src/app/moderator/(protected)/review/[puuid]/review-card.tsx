"use client";

import { useState } from "react";
import { useActionState } from "react";
import { editReviewAction, type ReviewFormState } from "./actions";
import { VERDICT_LABELS } from "@/lib/moderatorVerdicts";
import { ModeratorVerdict } from "@/generated/prisma";

const initialState: ReviewFormState = {};

export function ModeratorReviewCard({
  reviewId,
  puuid,
  verdict,
  rationale,
  moderatorDisplayName,
  createdAtLabel,
  canEdit,
}: {
  reviewId: string;
  puuid: string;
  verdict: ModeratorVerdict;
  rationale: string;
  moderatorDisplayName: string;
  createdAtLabel: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const action = editReviewAction.bind(null, reviewId, puuid);
  const [state, formAction, pending] = useActionState(action, initialState);
  const verdictId = `edit-verdict-${reviewId}`;
  const rationaleId = `edit-rationale-${reviewId}`;

  if (editing) {
    return (
      <form action={formAction} style={{ marginBottom: "0.5rem" }}>
        <div className="form-field">
          <label htmlFor={verdictId}>判定</label>
          <select id={verdictId} name="verdict" defaultValue={verdict} required>
            {(Object.keys(VERDICT_LABELS) as ModeratorVerdict[]).map((v) => (
              <option key={v} value={v}>
                {VERDICT_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor={rationaleId}>判断理由</label>
          <textarea
            id={rationaleId}
            name="rationale"
            rows={4}
            required
            minLength={10}
            defaultValue={rationale}
          />
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "更新中…" : "更新する"}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setEditing(false)}
            disabled={pending}
          >
            キャンセル
          </button>
        </div>
        {state.error && <p className="error-text">{state.error}</p>}
      </form>
    );
  }

  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <span className="badge badge-verified">{VERDICT_LABELS[verdict]}</span>
      <p style={{ marginTop: "0.5rem" }}>{rationale}</p>
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        {moderatorDisplayName} ・ {createdAtLabel}
      </p>
      {canEdit && (
        <button
          type="button"
          className="btn btn-secondary vote-btn"
          onClick={() => setEditing(true)}
        >
          編集
        </button>
      )}
    </div>
  );
}
