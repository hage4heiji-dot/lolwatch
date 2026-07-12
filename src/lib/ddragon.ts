// クライアント/サーバー両方から使う純粋関数のみを置く。
// バージョン取得(要fetch)やRiot APIキーを扱うロジックは riot.ts 側に置く。
export function getChampionIconUrl(ddragonVersion: string, championName: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${encodeURIComponent(championName)}.png`;
}

// DDragonバージョン取得に失敗した場合の最終手段のフォールバック(チャンピオンアイコンが
// 数パッチ古くなる可能性はあるが、画像自体は404にならない程度には安定して存在する)。
export const FALLBACK_DDRAGON_VERSION = "14.23.1";
