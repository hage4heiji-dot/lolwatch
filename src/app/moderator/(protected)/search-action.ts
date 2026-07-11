"use server";

import { redirect } from "next/navigation";
import { getAccountByRiotId, RiotApiError } from "@/lib/riot";
import { findPlayerByRiotId } from "@/lib/playerProfile";

export type ModeratorSearchState = { error?: string };

export async function moderatorSearchAction(
  _prevState: ModeratorSearchState,
  formData: FormData,
): Promise<ModeratorSearchState> {
  const name = String(formData.get("riotIdName") ?? "").trim();
  const tag = String(formData.get("riotIdTagLine") ?? "")
    .trim()
    .replace(/^#/, "");

  if (!name || !tag) {
    return { error: "ゲームID(例: SummonerName #JP1)を入力してください。" };
  }

  const existing = await findPlayerByRiotId(name, tag);
  if (existing) {
    redirect(`/moderator/review/${existing.puuid}`);
  }

  let puuid: string;
  try {
    const account = await getAccountByRiotId(name, tag);
    puuid = account.puuid;
  } catch (err) {
    if (err instanceof RiotApiError && err.status === 404) {
      return { error: "指定されたゲームIDが見つかりません。" };
    }
    return {
      error: "Riot APIへの問い合わせに失敗しました。時間をおいて再度お試しください。",
    };
  }

  redirect(`/moderator/review/${puuid}`);
}
