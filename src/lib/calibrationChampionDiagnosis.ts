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

// ヴァイ/エコー/レナータ(tier 2〜4)は平均が中間になるタイプだが、
// 「毎回1か5かをはっきり言い切った結果、平均するとたまたま中間になった」人と
// 「そもそも毎回3寄りで様子見する」人を同じキャラ扱いするのはおかしいため、
// 前者だけ専用の判定に振り分ける。
const DECISIVE_RESULT: CalibrationChampionResult = {
  championName: "Jayce",
  displayName: "ジェイス",
  title: "白黒はっきりタイプ",
  description:
    "ハンマー(近接)とキャノン(遠距離)を場面で完全に切り替えるように、「これは違反」「これは問題なし」を中間を置かずはっきり言い切るタイプ。平均すると中間的に見えますが、実際は場面ごとに判定が両極端に振れています。",
};

// 1・5のどちらか一方だけが多い場合はそもそも平均が中間にならず通常のtierに落ちるため、
// 両端に最低これだけの回答がある(=本当に両方に振れている)ことも条件にする。
const DECISIVE_MIN_EACH_EXTREME = 2;
// 全9問中これ以上が極端(1か5)なら「ほぼ全問はっきり言い切っている」とみなす。
const DECISIVE_MIN_TOTAL_EXTREME = 8;

function isDecisivePattern(scores: number[]): boolean {
  const count1 = scores.filter((s) => s === 1).length;
  const count5 = scores.filter((s) => s === 5).length;
  if (count1 < DECISIVE_MIN_EACH_EXTREME || count5 < DECISIVE_MIN_EACH_EXTREME) return false;
  return count1 + count5 >= DECISIVE_MIN_TOTAL_EXTREME;
}

export function getCalibrationChampionResult(scores: number[]): CalibrationChampionResult {
  const total = scores.reduce((a, b) => a + b, 0);
  const tier = tierFromAverage(total / scores.length);
  if ((tier === 2 || tier === 3 || tier === 4) && isDecisivePattern(scores)) {
    return DECISIVE_RESULT;
  }
  return CHAMPION_RESULTS[tier];
}

// 結果ページで「ほかにどんなタイプがあるか」を一覧表示するための全タイプ一覧。
// 厳しめ→緩めの順に並べ、ジェイスは特殊枠として末尾に置く。
export const ALL_CALIBRATION_CHAMPION_RESULTS: CalibrationChampionResult[] = [
  CHAMPION_RESULTS[1],
  CHAMPION_RESULTS[2],
  CHAMPION_RESULTS[3],
  CHAMPION_RESULTS[4],
  CHAMPION_RESULTS[5],
  DECISIVE_RESULT,
];
