// 通報した回数(横)×通報された回数(縦)の4象限グラフ。他の参加者は匿名の点で描き、自分を強調する。
// 状態を持たないSVGなので、読み込み直後の画面(クライアント)と共有ページ(サーバー)の両方で使える。
import type { RiotReportComparison } from "@/lib/riotReportStats";
import { QUADRANTS, type QuadrantKey } from "@/lib/reportCountTitle";

type Quadrant = NonNullable<RiotReportComparison["quadrant"]>;

const SIZE = 320;
const PAD_LEFT = 34;
const PAD_BOTTOM = 30;
const PAD_TOP = 10;
const PAD_RIGHT = 10;
const PLOT_W = SIZE - PAD_LEFT - PAD_RIGHT;
const PLOT_H = SIZE - PAD_TOP - PAD_BOTTOM;
const INSET = 10;

// 回数は一部の人に大きく偏るので平方根スケールにして、少ない側の差も見えるようにする。
function scale(value: number, max: number): number {
  return Math.sqrt(Math.max(0, value)) / Math.sqrt(max);
}

// 象限ラベルの位置(グラフの四隅)。
const CORNERS: Record<QuadrantKey, { x: number; y: number; anchor: "start" | "end" }> = {
  oops: { x: PAD_LEFT + 6, y: PAD_TOP + 16, anchor: "start" },
  clash: { x: SIZE - PAD_RIGHT - 6, y: PAD_TOP + 16, anchor: "end" },
  peace: { x: PAD_LEFT + 6, y: PAD_TOP + PLOT_H - 8, anchor: "start" },
  guardian: { x: SIZE - PAD_RIGHT - 6, y: PAD_TOP + PLOT_H - 8, anchor: "end" },
};

export function ReportQuadrantChart({
  quadrant,
  myReceived,
  meLabel = "あなた",
}: {
  quadrant: Quadrant;
  myReceived: number;
  meLabel?: string;
}) {
  const { myMade, medianReceived, medianMade, type, points } = quadrant;
  // 中央線がグラフの端に張り付かないよう、最大値は中央値の2倍以上にしておく。
  // 最大値の点が枠の端に張り付かないよう、少し(1.2倍)余裕をもたせる。
  const maxX = Math.max(1, myMade, medianMade * 2, ...points.map((p) => p[0])) * 1.2;
  const maxY = Math.max(1, myReceived, medianReceived * 2, ...points.map((p) => p[1])) * 1.2;
  // 0回の点が枠線に重なって欠けないよう、枠の内側に少し余白(INSET)をとって描く。
  const px = (v: number) => PAD_LEFT + INSET + scale(v, maxX) * (PLOT_W - INSET * 2);
  const py = (v: number) => PAD_TOP + PLOT_H - INSET - scale(v, maxY) * (PLOT_H - INSET * 2);

  const midX = px(medianMade);
  const midY = py(medianReceived);
  const myX = px(myMade);
  const myY = py(myReceived);

  // 自分のいる象限だけ薄く色を付ける。
  const highlight = {
    oops: { x: PAD_LEFT, y: PAD_TOP, w: midX - PAD_LEFT, h: midY - PAD_TOP },
    clash: { x: midX, y: PAD_TOP, w: SIZE - PAD_RIGHT - midX, h: midY - PAD_TOP },
    peace: { x: PAD_LEFT, y: midY, w: midX - PAD_LEFT, h: PAD_TOP + PLOT_H - midY },
    guardian: { x: midX, y: midY, w: SIZE - PAD_RIGHT - midX, h: PAD_TOP + PLOT_H - midY },
  }[type];

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="rq-chart"
      role="img"
      aria-label={`4象限グラフ。${meLabel}は${QUADRANTS[type].name}`}
    >
      <rect x={PAD_LEFT} y={PAD_TOP} width={PLOT_W} height={PLOT_H} className="rq-plot" />
      <rect
        x={highlight.x}
        y={highlight.y}
        width={highlight.w}
        height={highlight.h}
        className="rq-highlight"
      />

      <line x1={midX} x2={midX} y1={PAD_TOP} y2={PAD_TOP + PLOT_H} className="rq-median" />
      <line x1={PAD_LEFT} x2={SIZE - PAD_RIGHT} y1={midY} y2={midY} className="rq-median" />

      {(Object.keys(CORNERS) as QuadrantKey[]).map((key) => (
        <text
          key={key}
          x={CORNERS[key].x}
          y={CORNERS[key].y}
          textAnchor={CORNERS[key].anchor}
          className={`rq-label${key === type ? " rq-label-active" : ""}`}
        >
          {QUADRANTS[key].emoji} {QUADRANTS[key].name}
        </text>
      ))}

      {points.map(([x, y], i) => (
        <circle key={i} cx={px(x)} cy={py(y)} r={3.2} className="rq-point" />
      ))}

      <circle cx={myX} cy={myY} r={11} className="rq-me-ring" />
      <circle cx={myX} cy={myY} r={6} className="rq-me" />
      <text
        x={myX}
        // 上端付近では文字が枠外に切れるので、点の下に出す。
        y={myY < PAD_TOP + 30 ? myY + 24 : myY - 15}
        textAnchor={myX > SIZE - 50 ? "end" : myX < PAD_LEFT + 30 ? "start" : "middle"}
        className="rq-me-label"
      >
        {meLabel}
      </text>

      <text x={PAD_LEFT + PLOT_W / 2} y={SIZE - 8} textAnchor="middle" className="rq-axis">
        通報した回数 →
      </text>
      <text
        x={12}
        y={PAD_TOP + PLOT_H / 2}
        textAnchor="middle"
        transform={`rotate(-90 12 ${PAD_TOP + PLOT_H / 2})`}
        className="rq-axis"
      >
        通報された回数 →
      </text>
    </svg>
  );
}
