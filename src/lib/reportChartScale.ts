// 通報回数グラフ(4象限・レベルあたり散布図)の座標計算。画面のSVGとOGP画像(next/og)の両方で使う。
// 戻り値はすべて0〜1に正規化した位置(0=左/下、1=右/上)。

// 回数は整数で、判定は「中央値より多いか」なので、境界線は floor(中央値)+0.5 に引く。
// こうすると中央値ちょうどの点が線の上に乗らず、判定どおりの側に描かれる。
export function quadrantBoundary(median: number): number {
  return Math.floor(median) + 0.5;
}

// 境界(boundary)がちょうど0.5(グラフの中心)に来るよう、境界の前後で別々に伸ばす。
// 回数は一部の人に大きく偏るので、それぞれの半分の中では平方根スケールにして少ない側の差も見えるようにする。
export function centeredSqrtScale(value: number, boundary: number, max: number): number {
  const v = Math.sqrt(Math.max(0, value));
  const b = Math.sqrt(boundary);
  if (v <= b) return 0.5 * (v / b);
  return 0.5 + 0.5 * Math.min(1, (v - b) / (Math.sqrt(max) - b));
}

// 境界のない単純な平方根スケール(散布図用)。
export function sqrtScale(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.sqrt(Math.max(0, value)) / Math.sqrt(max));
}

export type QuadrantAxes = {
  x: (made: number) => number;
  y: (received: number) => number;
  // 境界線の位置(常に0.5)
  mid: 0.5;
};

// 4象限グラフの座標変換を作る。points は [通報した回数, 通報された回数] の列。
export function buildQuadrantAxes(
  medianMade: number,
  medianReceived: number,
  values: [number, number][],
): QuadrantAxes {
  const bx = quadrantBoundary(medianMade);
  const by = quadrantBoundary(medianReceived);
  // 上半分(右半分)の目盛り用の最大値。最大値の点が端に張り付かないよう1.2倍の余裕をもたせ、
  // 境界より多い点がいない場合でも上半分が潰れないよう境界の2倍以上にしておく。
  const maxX = Math.max(bx * 2, ...values.map((v) => v[0])) * 1.2;
  const maxY = Math.max(by * 2, ...values.map((v) => v[1])) * 1.2;
  return {
    x: (made) => centeredSqrtScale(made, bx, maxX),
    y: (received) => centeredSqrtScale(received, by, maxY),
    mid: 0.5,
  };
}

// 散布図(横=通報された回数、縦=レベル100あたりの通報された回数)の座標変換を作る。
export function buildPerLevelAxes(values: [number, number][]): {
  x: (received: number) => number;
  y: (perLevel: number) => number;
} {
  const maxX = Math.max(1, ...values.map((v) => v[0])) * 1.15;
  const maxY = Math.max(1, ...values.map((v) => v[1])) * 1.15;
  return { x: (v) => sqrtScale(v, maxX), y: (v) => sqrtScale(v, maxY) };
}

// レベル100あたりの通報された回数(小数1桁)。レベル不明ならnull。
export function reportsPer100Levels(received: number, level: number | null): number | null {
  if (!level || level <= 0) return null;
  return Math.round((received / level) * 1000) / 10;
}

// 「通報された回数」の分布(棒グラフ)の刻み幅と最大本数。最後の棒は「◯〜」にまとめる。
export const DISTRIBUTION_STEP = 20;
const DISTRIBUTION_MAX_BINS = 10;

export type DistributionBin = { label: string; count: number; isMine: boolean };

// 参加者の通報された回数を DISTRIBUTION_STEP 刻みで数える。棒の本数は最大値(自分を含む)に
// 合わせて決め、多すぎる場合は最後の棒を「◯〜」にまとめる。
export function buildReceivedDistribution(values: number[], myReceived: number): DistributionBin[] {
  const max = values.reduce((m, v) => Math.max(m, v), Math.max(myReceived, 0));
  const bins = Math.min(Math.floor(max / DISTRIBUTION_STEP) + 1, DISTRIBUTION_MAX_BINS);
  const indexOf = (v: number) => Math.min(Math.floor(v / DISTRIBUTION_STEP), bins - 1);
  const counts = Array.from({ length: bins }, () => 0);
  for (const v of values) counts[indexOf(v)]++;
  const myIndex = indexOf(myReceived);
  return counts.map((count, i) => {
    const min = i * DISTRIBUTION_STEP;
    const isLast = i === bins - 1 && max >= (i + 1) * DISTRIBUTION_STEP;
    return {
      label: isLast ? `${min}〜` : `${min}〜${min + DISTRIBUTION_STEP - 1}`,
      count,
      isMine: i === myIndex,
    };
  });
}
