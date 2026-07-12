"use client";

import { useActionState } from "react";
import { submitReviewAction, type ReviewFormState } from "./actions";
import { VERDICT_LABELS } from "@/lib/moderatorVerdicts";
import { ModeratorVerdict } from "@/generated/prisma";

const initialState: ReviewFormState = {};

export function ReviewForm({ reportId, puuid }: { reportId: string; puuid: string }) {
  const action = submitReviewAction.bind(null, reportId, puuid);
  const [state, formAction, pending] = useActionState(action, initialState);
  const verdictId = `verdict-${reportId}`;
  const rationaleId = `rationale-${reportId}`;

  return (
    <form action={formAction}>
      <div className="form-field">
        <label htmlFor={verdictId}>判定</label>
        <select id={verdictId} name="verdict" defaultValue="" required>
          <option value="" disabled>
            選択してください
          </option>
          {(Object.keys(VERDICT_LABELS) as ModeratorVerdict[]).map((verdict) => (
            <option key={verdict} value={verdict}>
              {VERDICT_LABELS[verdict]}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor={rationaleId}>判断理由(判断指針に基づき具体的に記載)</label>
        <textarea id={rationaleId} name="rationale" rows={5} required minLength={10} />
      </div>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "送信中…" : "評価を登録"}
      </button>
      {state.error && <p className="error-text">{state.error}</p>}
    </form>
  );
}
