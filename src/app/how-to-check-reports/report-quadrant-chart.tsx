// 通報した回数(横)×通報された回数(縦)の4象限グラフ。他の参加者は匿名の点で描き、自分を強調する。
// 状態を持たないSVGなので、読み込み直後の画面(クライアント)と共有ページ(サーバー)の両方で使える。
// 暗いパネル(.rq-panel)の上に置く前提の配色。
import type { RiotReportComparison } from "@/lib/riotReportStats";
import { getTypeName, LEANS, QUADRANTS, type QuadrantKey } from "@/lib/reportCountTitle";
import { buildQuadrantAxes } from "@/lib/reportChartScale";

type Quadrant = NonNullable<RiotReportComparison["quadrant"]>;

const SIZE = 320;
const PAD = 8;
const PLOT = SIZE - PAD * 2;
const MID = PAD + PLOT / 2;
// 0回の点が四隅の象限ラベル(特に左下の「平和主義型」)に重ならない程度の内側余白。
const INSET = 26;

// 象限ごとの領域とラベル位置。
const AREAS: Record<
  QuadrantKey,
  { x: number; y: number; labelX: number; labelY: number; anchor: "start" | "end" }
> = {
  oops: { x: PAD, y: PAD, labelX: PAD + 10, labelY: PAD + 20, anchor: "start" },
  clash: { x: MID, y: PAD, labelX: SIZE - PAD - 10, labelY: PAD + 20, anchor: "end" },
  peace: { x: PAD, y: MID, labelX: PAD + 10, labelY: SIZE - PAD - 11, anchor: "start" },
  guardian: { x: MID, y: MID, labelX: SIZE - PAD - 10, labelY: SIZE - PAD - 11, anchor: "end" },
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
  const { myMade, medianReceived, medianMade, type, lean, points } = quadrant;
  // 座標計算はOGP画像と共通(src/lib/reportChartScale.ts)。境界線は常にグラフの中心に来る。
  const axes = buildQuadrantAxes(medianMade, medianReceived, [
    [myMade, myReceived],
    ...points.map((p) => [p[0], p[1]] as [number, number]),
  ]);
  const px = (v: number) => PAD + INSET + axes.x(v) * (PLOT - INSET * 2);
  const py = (v: number) => PAD + PLOT - INSET - axes.y(v) * (PLOT - INSET * 2);
  const myX = px(myMade);
  const myY = py(myReceived);
  const myColor = LEANS[lean].color;

  return (
    <div className="rq-chart-wrap">
      <div className="rq-axis-y">↑ 通報された回数</div>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="rq-chart"
        role="img"
        aria-label={`4象限グラフ。${meLabel}は${getTypeName(type, lean)}`}
      >
        <defs>
          <filter id="rq-q-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="rq-q-clip">
            <rect x={PAD} y={PAD} width={PLOT} height={PLOT} rx={14} />
          </clipPath>
        </defs>

        <rect x={PAD} y={PAD} width={PLOT} height={PLOT} rx={14} className="rq-plot" />
        {/* 象限ごとに色を付け、自分のいる象限だけ濃くする(角丸に合わせてクリップ) */}
        <g clipPath="url(#rq-q-clip)">
          {(Object.keys(AREAS) as QuadrantKey[]).map((key) => (
            <rect
              key={key}
              x={AREAS[key].x}
              y={AREAS[key].y}
              width={PLOT / 2}
              height={PLOT / 2}
              fill={QUADRANTS[key].color}
              className={`rq-area${key === type ? " rq-area-active" : ""}`}
            />
          ))}
        </g>
        <rect x={PAD} y={PAD} width={PLOT} height={PLOT} rx={14} className="rq-frame" />

        <line x1={MID} x2={MID} y1={PAD} y2={PAD + PLOT} className="rq-median" />
        <line x1={PAD} x2={PAD + PLOT} y1={MID} y2={MID} className="rq-median" />

        {(Object.keys(AREAS) as QuadrantKey[]).map((key) => (
          <text
            key={key}
            x={AREAS[key].labelX}
            y={AREAS[key].labelY}
            textAnchor={AREAS[key].anchor}
            className={`rq-label${key === type ? " rq-label-active" : ""}`}
            style={key === type ? { fill: QUADRANTS[key].color } : undefined}
          >
            {QUADRANTS[key].emoji} {QUADRANTS[key].name}
          </text>
        ))}

        <g filter="url(#rq-q-glow)">
          {points.map(([x, y, pointLean], i) => (
            <circle
              key={i}
              cx={px(x)}
              cy={py(y)}
              r={3.8}
              fill={LEANS[pointLean].color}
              className="rq-point"
            />
          ))}
        </g>

        <circle cx={myX} cy={myY} r={14} stroke={myColor} className="rq-me-pulse" />
        <circle cx={myX} cy={myY} r={10} stroke={myColor} className="rq-me-ring" />
        <circle cx={myX} cy={myY} r={6.5} fill={myColor} className="rq-me" />
        {/* 上端付近ではタグが枠外に出るので点の下に置く */}
        <g
          transform={`translate(${Math.min(Math.max(myX, PAD + 30), SIZE - PAD - 30)} ${myY < PAD + 44 ? myY + 30 : myY - 30})`}
        >
          <rect x={-24} y={-11} width={48} height={21} rx={10.5} fill={myColor} />
          <text x={0} y={4} textAnchor="middle" className="rq-me-tag">
            {meLabel}
          </text>
        </g>
      </svg>
      <div className="rq-axis-x">通報した回数 →</div>
      <ul className="rq-legend">
        {(["conduct", "play", "none"] as const).map((key) => (
          <li key={key}>
            <span className="rq-legend-dot" style={{ background: LEANS[key].color }} />
            {key === "none" ? "傾向なし" : `${LEANS[key].label}の通報が多い`}
          </li>
        ))}
      </ul>
    </div>
  );
}
