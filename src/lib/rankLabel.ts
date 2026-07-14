export const TIER_LABELS: Record<string, string> = {
  IRON: "アイアン",
  BRONZE: "ブロンズ",
  SILVER: "シルバー",
  GOLD: "ゴールド",
  PLATINUM: "プラチナ",
  EMERALD: "エメラルド",
  DIAMOND: "ダイヤモンド",
  MASTER: "マスター",
  GRANDMASTER: "グランドマスター",
  CHALLENGER: "チャレンジャー",
};

const NO_DIVISION_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

export function formatRank(entry: { tier: string; rank: string; leaguePoints: number }): string {
  const tierLabel = TIER_LABELS[entry.tier] ?? entry.tier;
  const division = NO_DIVISION_TIERS.has(entry.tier) ? "" : ` ${entry.rank}`;
  return `${tierLabel}${division} ・ ${entry.leaguePoints}LP`;
}
