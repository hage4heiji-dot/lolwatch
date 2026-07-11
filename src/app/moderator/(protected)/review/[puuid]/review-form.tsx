"use client";

import { useActionState } from "react";
import { submitReviewAction, type ReviewFormState } from "./actions";
import { VERDICT_LABELS } from "@/lib/moderatorVerdicts";
import { ModeratorVerdict } from "@/generated/prisma";

const initialState: ReviewFormState = {};

export function ReviewForm({ puuid }: { puuid: string }) {
  const action = submitReviewAction.bind(null, puuid);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <div className="form-field">
        <label htmlFor="verdict">判定</label>
        <select id="verdict" name="verdict" defaultValue="" required>
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
        <label htmlFor="rationale">判断理由(判断指針に基づき具体的に記載)</label>
        <textarea id="rationale" name="rationale" rows={5} required minLength={10} />
      </div>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "送信中…" : "評価を登録"}
      </button>
      {state.error && <p className="error-text">{state.error}</p>}
    </form>
  );
}
