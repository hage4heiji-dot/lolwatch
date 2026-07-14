// クライアント/サーバー両方から使う純粋関数のみを置く。
// バージョン取得(要fetch)やRiot APIキーを扱うロジックは riot.ts 側に置く。

// Match APIのchampionNameとDDragonの画像キーが一致しないチャンピオンの補正表。
// (例: FiddlesticksはMatch APIが "FiddleSticks" を返すが、DDragonの画像キーは "Fiddlesticks")
const CHAMPION_NAME_DDRAGON_OVERRIDES: Record<string, string> = {
  FiddleSticks: "Fiddlesticks",
};

export function getChampionIconUrl(ddragonVersion: string, championName: string): string {
  const normalized = CHAMPION_NAME_DDRAGON_OVERRIDES[championName] ?? championName;
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${encodeURIComponent(normalized)}.png`;
}

// DDragonバージョン取得に失敗した場合の最終手段のフォールバック(チャンピオンアイコンが
// 数パッチ古くなる可能性はあるが、画像自体は404にならない程度には安定して存在する)。
export const FALLBACK_DDRAGON_VERSION = "14.23.1";

// ランクエンブレム画像。Riot公式のDataDragonにはランクエンブレムが含まれていないため、
// ゲームクライアントのアセットをミラーしているCommunity Dragon(LoL関連サイトで
// 広く使われている安定した非公式CDN)を利用する。
// ranked-emblem/配下は2560x1440の大きな背景素材でアイコン用途には向かないため、
// 正方形に切り出し済みのranked-mini-crests/を使う。
// 拡張子はsvgを使う(emeraldのみpngが用意されておらず404になるため、
// 全ティアで確実に存在するsvgに統一している)。
export function getRankEmblemUrl(tier: string | null): string {
  const name = tier ? tier.toLowerCase() : "unranked";
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${name}.svg`;
}
