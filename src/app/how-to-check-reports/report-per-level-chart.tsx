// 散布図: 横=通報された回数、縦=レベル100あたりの通報された回数。
// 「回数は多いけどたくさん遊んでいるだけ」か「少ない試合数で多く通報されている」かを見分ける用。
// 状態を持たないSVGなので、読み込み直後の画面と共有ページの両方で使える。暗いパネル(.rq-panel)の上に置く前提。
import type { RiotReportComparison } from "@/lib/riotReportStats";
import { LEANS, type ReportLean } from "@/lib/reportCountTitle";
import { buildPerLevelAxes } from "@/lib/reportChartScale";

type PerLevel = RiotReportComparison["perLevel"];

const SIZE = 320;
const PAD = 8;
const PLOT = SIZE - PAD * 2;
const INSET = 16;
const GRID = [0.25, 0.5, 0.75];

export function ReportPerLevelChart({
  perLevel,
  myReceived,
  myLean,
  meLabel = "あなた",
}: {
  perLevel: PerLevel;
  myReceived: number;
  myLean: ReportLean;
  meLabel?: string;
}) {
  const { myPer100, points } = perLevel;
  const axes = buildPerLevelAxes([
    ...(myPer100 !== null ? [[myReceived, myPer100] as [number, number]] : []),
    ...points.map((p) => [p[0], p[1]] as [number, number]),
  ]);
  const px = (v: number) => PAD + INSET + axes.x(v) * (PLOT - INSET * 2);
  const py = (v: number) => PAD + PLOT - INSET - axes.y(v) * (PLOT - INSET * 2);
  const myX = myPer100 !== null ? px(myReceived) : null;
  const myY = myPer100 !== null ? py(myPer100) : null;
  const myColor = LEANS[myLean].color;

  return (
    <div className="rq-chart-wrap">
      <div className="rq-axis-y">↑ レベル100あたりの通報</div>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="rq-chart"
        role="img"
        aria-label={`通報された回数とレベル100あたりの通報された回数の散布図${
          myPer100 !== null ? `。${meLabel}はレベル100あたり${myPer100}回` : ""
        }`}
      >
        <defs>
          {/* 右上(回数が多く、遊んだ量の割にも多い)ほど赤く */}
          <linearGradient id="rq-l-heat" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#4fd1a5" stopOpacity="0.10" />
            <stop offset="55%" stopColor="#ff9f43" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ff5a5f" stopOpacity="0.32" />
          </linearGradient>
          <filter id="rq-l-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x={PAD} y={PAD} width={PLOT} height={PLOT} rx={14} className="rq-plot" />
        <rect x={PAD} y={PAD} width={PLOT} height={PLOT} rx={14} fill="url(#rq-l-heat)" />
        {GRID.map((g) => (
          <g key={g}>
            <line
              x1={PAD + PLOT * g}
              x2={PAD + PLOT * g}
              y1={PAD}
              y2={PAD + PLOT}
              className="rq-grid"
            />
            <line
              x1={PAD}
              x2={PAD + PLOT}
              y1={PAD + PLOT * g}
              y2={PAD + PLOT * g}
              className="rq-grid"
            />
          </g>
        ))}
        <rect x={PAD} y={PAD} width={PLOT} height={PLOT} rx={14} className="rq-frame" />

        <text x={SIZE - PAD - 10} y={PAD + 20} textAnchor="end" className="rq-label rq-label-hot">
          🔥 少ない試合で多く通報
        </text>
        <text x={SIZE - PAD - 10} y={SIZE - PAD - 11} textAnchor="end" className="rq-label">
          🎮 たくさん遊んでいるぶん多い
        </text>

        <g filter="url(#rq-l-glow)">
          {points.map(([x, y, lean], i) => (
            <circle
              key={i}
              cx={px(x)}
              cy={py(y)}
              r={3.8}
              fill={LEANS[lean].color}
              className="rq-point"
            />
          ))}
        </g>

        {myX !== null && myY !== null && (
          <>
            <circle cx={myX} cy={myY} r={14} stroke={myColor} className="rq-me-pulse" />
            <circle cx={myX} cy={myY} r={10} stroke={myColor} className="rq-me-ring" />
            <circle cx={myX} cy={myY} r={6.5} fill={myColor} className="rq-me" />
            <g
              transform={`translate(${Math.min(Math.max(myX, PAD + 30), SIZE - PAD - 30)} ${myY < PAD + 44 ? myY + 30 : myY - 30})`}
            >
              <rect x={-24} y={-11} width={48} height={21} rx={10.5} fill={myColor} />
              <text x={0} y={4} textAnchor="middle" className="rq-me-tag">
                {meLabel}
              </text>
            </g>
          </>
        )}
      </svg>
      <div className="rq-axis-x">通報された回数 →</div>
    </div>
  );
}
