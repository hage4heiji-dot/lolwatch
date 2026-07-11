"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { attemptLogin, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/moderatorAuth";

export type LoginFormState = { error?: string };

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "ユーザー名とパスワードを入力してください。" };
  }

  const result = await attemptLogin(username, password);
  if (!result.ok) {
    return { error: result.error };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, result.token, SESSION_COOKIE_OPTIONS);

  redirect("/moderator");
}
