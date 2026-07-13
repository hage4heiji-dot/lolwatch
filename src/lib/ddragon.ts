// クライアント/サーバー両方から使う純粋関数のみを置く。
// バージョン取得(要fetch)やRiot APIキーを扱うロジックは riot.ts 側に置く。
export function getChampionIconUrl(ddragonVersion: string, championName: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${encodeURIComponent(championName)}.png`;
}

// DDragonバージョン取得に失敗した場合の最終手段のフォールバック(チャンピオンアイコンが
// 数パッチ古くなる可能性はあるが、画像自体は404にならない程度には安定して存在する)。
export const FALLBACK_DDRAGON_VERSION = "14.23.1";

// ランクエンブレム画像。Riot公式のDataDragonにはランクエンブレムが含まれていないため、
// ゲームクライアントのアセットをミラーしているCommunity Dragon(LoL関連サイトで
// 広く使われている安定した非公式CDN)を利用する。
// ranked-emblem/配下は2560x1440の大きな背景素材でアイコン用途には向かないため、
// 正方形に切り出し済みのranked-mini-crests/を使う。
export function getRankEmblemUrl(tier: string | null): string {
  const name = tier ? tier.toLowerCase() : "unranked";
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${name}.png`;
}
