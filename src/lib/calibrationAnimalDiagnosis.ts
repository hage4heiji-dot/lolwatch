// 結果ページの「動物診断」風の一言。平均スコア(1=違反〜5=問題なし)を
// 5段階に区切り、それぞれに寄せたキャラクター付けをするだけの遊び要素。
// 統計的な意味は持たせず、あくまでシェアされたときに楽しい見た目になることが目的。
export type CalibrationAnimalResult = {
  emoji: string;
  animal: string;
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

const ANIMAL_RESULTS: Record<Tier, CalibrationAnimalResult> = {
  1: {
    emoji: "🐺",
    animal: "オオカミ",
    title: "規律の番人タイプ",
    description:
      "グレーな場面でも「悪意の芽は早めに摘む」主義。群れの掟に厳しいオオカミのように、疑わしきは違反寄りに判定する傾向があります。",
  },
  2: {
    emoji: "🐕",
    animal: "ジャーマンシェパード",
    title: "しっかり者タイプ",
    description:
      "基本はルール重視。ただしオオカミほど白黒はっきりさせず、状況次第では大目に見る柔軟さも持ち合わせています。",
  },
  3: {
    emoji: "🐱",
    animal: "ネコ",
    title: "気分屋ジャッジタイプ",
    description:
      "「今日はこの気分」で判定が変わる、ネコのようなバランス型。良くも悪くも人間らしい、ケースバイケースの判定基準です。",
  },
  4: {
    emoji: "🐶",
    animal: "ゴールデンレトリバー",
    title: "みんな良い子タイプ",
    description:
      "基本的には「まあ良いんじゃない?」と大らか。よほど分かりやすい悪意がない限り、相手の事情を汲んで問題なし寄りに判定する傾向があります。",
  },
  5: {
    emoji: "🐼",
    animal: "パンダ",
    title: "のんびり平和主義タイプ",
    description:
      "グレーな行為も「まあそういう日もある」で受け流す、パンダ級の心の広さ。争いより平和を好む、極めて寛容な判定基準の持ち主です。",
  },
};

export function getCalibrationAnimalResult(average: number): CalibrationAnimalResult {
  return ANIMAL_RESULTS[tierFromAverage(average)];
}
