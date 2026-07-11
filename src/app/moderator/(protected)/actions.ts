"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, destroySessionByToken } from "@/lib/moderatorAuth";

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await destroySessionByToken(token);
  }
  store.delete(SESSION_COOKIE);
  redirect("/moderator/login");
}
