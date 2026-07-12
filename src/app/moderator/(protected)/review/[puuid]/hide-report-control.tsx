"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  hideReportAction,
  unhideReportAction,
  type ModerationFormState,
} from "./moderation-actions";

const initialState: ModerationFormState = {};

export function HideReportControl({
  reportId,
  puuid,
  hiddenAt,
  hiddenReason,
}: {
  reportId: string;
  puuid: string;
  hiddenAt: string | null;
  hiddenReason: string | null;
}) {
  const [showForm, setShowForm] = useState(false);
  const hideAction = hideReportAction.bind(null, reportId, puuid);
  const unhideAction = unhideReportAction.bind(null, reportId, puuid);
  const [hideState, hideFormAction, hidePending] = useActionState(hideAction, initialState);
  const [unhideState, unhideFormAction, unhidePending] = useActionState(
    unhideAction,
    initialState,
  );

  if (hiddenAt) {
    return (
      <div style={{ marginTop: "0.5rem" }}>
        <span className="badge badge-verified-guilty">
          非表示中{hiddenReason ? `(理由: ${hiddenReason})` : ""}
        </span>
        <form action={unhideFormAction} style={{ marginTop: "0.35rem" }}>
          <button className="btn btn-secondary vote-btn" type="submit" disabled={unhidePending}>
            {unhidePending ? "処理中…" : "表示に戻す"}
          </button>
        </form>
        {unhideState.error && <p className="error-text">{unhideState.error}</p>}
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        type="button"
        className="btn btn-secondary vote-btn"
        style={{ marginTop: "0.5rem" }}
        onClick={() => setShowForm(true)}
      >
        この通報を非表示にする(管理者)
      </button>
    );
  }

  return (
    <form action={hideFormAction} style={{ marginTop: "0.5rem" }}>
      <div className="form-field">
        <label htmlFor={`hide-reason-${reportId}`}>非表示理由</label>
        <input id={`hide-reason-${reportId}`} name="reason" required minLength={3} maxLength={200} />
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="btn" type="submit" disabled={hidePending}>
          {hidePending ? "処理中…" : "非表示にする"}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => setShowForm(false)}
          disabled={hidePending}
        >
          キャンセル
        </button>
      </div>
      {hideState.error && <p className="error-text">{hideState.error}</p>}
    </form>
  );
}
