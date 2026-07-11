"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "./actions";

const initialState: LoginFormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction}>
      <div className="form-field">
        <label htmlFor="username">ユーザー名</label>
        <input id="username" name="username" autoComplete="username" required />
      </div>
      <div className="form-field">
        <label htmlFor="password">パスワード</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "ログイン中…" : "ログイン"}
      </button>
      {state.error && <p className="error-text">{state.error}</p>}
    </form>
  );
}
