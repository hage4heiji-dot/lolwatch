// クライアント/サーバー両方から使う純粋関数のみを置く。
// バージョン取得(要fetch)やRiot APIキーを扱うロジックは riot.ts 側に置く。
export function getChampionIconUrl(ddragonVersion: string, championName: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${encodeURIComponent(championName)}.png`;
}
