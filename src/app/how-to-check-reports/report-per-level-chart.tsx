// 散布図: 横=通報された回数、縦=レベル100あたりの通報された回数。
// 「回数は多いけどたくさん遊んでいるだけ」か「少ない試合数で多く通報されている」かを見分ける用。
// 状態を持たないSVGなので、読み込み直後の画面と共有ページの両方で使える。
import type { RiotReportComparison } from "@/lib/riotReportStats";
import { LEANS, type ReportLean } from "@/lib/reportCountTitle";
import { buildPerLevelAxes } from "@/lib/reportChartScale";

type PerLevel = RiotReportComparison["perLevel"];

const SIZE = 320;
const PAD_LEFT = 34;
const PAD_BOTTOM = 30;
const PAD_TOP = 10;
const PAD_RIGHT = 10;
const PLOT_W = SIZE - PAD_LEFT - PAD_RIGHT;
const PLOT_H = SIZE - PAD_TOP - PAD_BOTTOM;
const INSET = 14;

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
  const px = (v: number) => PAD_LEFT + INSET + axes.x(v) * (PLOT_W - INSET * 2);
  const py = (v: number) => PAD_TOP + PLOT_H - INSET - axes.y(v) * (PLOT_H - INSET * 2);
  const myX = myPer100 !== null ? px(myReceived) : null;
  const myY = myPer100 !== null ? py(myPer100) : null;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="rq-chart"
      role="img"
      aria-label={`通報された回数とレベル100あたりの通報された回数の散布図${
        myPer100 !== null ? `。${meLabel}はレベル100あたり${myPer100}回` : ""
      }`}
    >
      <rect x={PAD_LEFT} y={PAD_TOP} width={PLOT_W} height={PLOT_H} className="rq-plot" />
      <text x={SIZE - PAD_RIGHT - 6} y={PAD_TOP + 16} textAnchor="end" className="rq-label">
        少ない試合で多く通報 ↗
      </text>

      {points.map(([x, y, lean], i) => (
        <circle
          key={i}
          cx={px(x)}
          cy={py(y)}
          r={3.6}
          fill={LEANS[lean].color}
          className="rq-point"
        />
      ))}

      {myX !== null && myY !== null && (
        <>
          <circle cx={myX} cy={myY} r={11} className="rq-me-ring" />
          <circle cx={myX} cy={myY} r={6.5} fill={LEANS[myLean].color} className="rq-me" />
          <text
            x={myX}
            y={myY < PAD_TOP + 30 ? myY + 24 : myY - 15}
            textAnchor={myX > SIZE - 50 ? "end" : myX < PAD_LEFT + 30 ? "start" : "middle"}
            className="rq-me-label"
          >
            {meLabel}
          </text>
        </>
      )}

      <text x={PAD_LEFT + PLOT_W / 2} y={SIZE - 8} textAnchor="middle" className="rq-axis">
        通報された回数 →
      </text>
      <text
        x={12}
        y={PAD_TOP + PLOT_H / 2}
        textAnchor="middle"
        transform={`rotate(-90 12 ${PAD_TOP + PLOT_H / 2})`}
        className="rq-axis"
      >
        レベル100あたりの通報された回数 →
      </text>
    </svg>
  );
}
