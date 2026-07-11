"use client";

import { useActionState } from "react";
import { moderatorSearchAction, type ModeratorSearchState } from "./search-action";

const initialState: ModeratorSearchState = {};

export function ModeratorSearchForm() {
  const [state, formAction, pending] = useActionState(
    moderatorSearchAction,
    initialState,
  );

  return (
    <form action={formAction}>
      <div className="form-row">
        <div className="form-field">
          <label htmlFor="riotIdName">ゲーム名</label>
          <input id="riotIdName" name="riotIdName" autoComplete="off" required />
        </div>
        <div className="form-field">
          <label htmlFor="riotIdTagLine">タグ</label>
          <input id="riotIdTagLine" name="riotIdTagLine" autoComplete="off" required />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "検索中…" : "レビュー対象を検索"}
      </button>
      {state.error && <p className="error-text">{state.error}</p>}
    </form>
  );
}
