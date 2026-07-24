// 結果ページの「チャンピオン診断」風の一言。平均スコア(1=違反〜5=問題なし)を
// 5段階に区切り、ピルトーヴァー/ゾウンのチャンピオンに寄せたキャラクター付けをするだけの
// 遊び要素。統計的な意味は持たせず、シェアされたときに映える見た目にするのが目的。
export type CalibrationChampionResult = {
  // Data Dragonの画像キー(getChampionIconUrlにそのまま渡す)。
  championName: string;
  displayName: string;
  title: string;
  description: string;
};

type Tier = 1 | 2 | 3 | 4 | 5;

function tierFromAverage(average: number): Tier {
  if (average <= 1.8) return 1;
  if (average <= 2.6) return 2;
  if (average <= 3.4) return 3;
  if (average <= 4.2) return 4;
  return 5;
}

const CHAMPION_RESULTS: Record<Tier, CalibrationChampionResult> = {
  1: {
    championName: "Caitlyn",
    displayName: "ケイトリン",
    title: "ピルトーヴァーの保安官タイプ",
    description:
      "疑わしきは罰する主義。グレーな場面でも証拠と手順を重視し、ルール違反には容赦なく踏み込みます。",
  },
  2: {
    championName: "Vi",
    displayName: "ヴァイ",
    title: "現場主義の取締官タイプ",
    description:
      "細かい手続きより現場の空気を重視。曲がったことは許さないものの、ケイトリンほど杓子定規ではありません。",
  },
  3: {
    championName: "Ekko",
    displayName: "エコー",
    title: "その場しのぎの調整役タイプ",
    description:
      "白黒つけるより、状況に応じて落としどころを探すタイプ。同じ行為でも文脈次第で判定が変わります。",
  },
  4: {
    championName: "Renata",
    displayName: "レナータ・グラスク",
    title: "実利重視の温情タイプ",
    description:
      "大きな実害がなければ多少のグレーは大目に見る、ビジネスライクな寛容さの持ち主。関係が壊れない範囲なら目をつむります。",
  },
  5: {
    championName: "Jinx",
    displayName: "ジンクス",
    title: "カオス上等タイプ",
    description:
      "ルールより「おもしろいかどうか」が判断基準。多少の無茶や悪ふざけも、まあ笑って済ませる寛容さの持ち主です。",
  },
};

export function getCalibrationChampionResult(average: number): CalibrationChampionResult {
  return CHAMPION_RESULTS[tierFromAverage(average)];
}
