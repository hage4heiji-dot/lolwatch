import { ImageResponse } from "next/og";
import { loadGoogleFontJP } from "@/lib/ogFont";
import {
  asCountMap,
  chatSummaryFromRow,
  getRiotReportComparison,
  getRiotReportStatForShare,
} from "@/lib/riotReportStats";
import {
  getReportCountTitle,
  getTypeName,
  LEANS,
  TONE_COLORS,
  type ReportLean,
} from "@/lib/reportCountTitle";
import { buildPerLevelAxes, buildQuadrantAxes } from "@/lib/reportChartScale";
import { chatRates } from "@/lib/chatStats";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "LoLで通報された回数";
// 送り直した直後に共有されることが多いので、使い回しは1分程度にとどめる。
export const revalidate = 60;

const CHART_SIZE = 236;
const CHART_INSET = 16;

type Dot = { x: number; y: number; color: string };

// next/og(satori)はSVGの対応が限定的なので、グラフは絶対配置のdivで描く。x,yは0〜1(0=左/下)。
function MiniChart({
  caption,
  axisLabel,
  dots,
  me,
  accent,
  centerLines,
  corners,
}: {
  caption: string;
  // 「横: ○○ ・ 縦: ○○」。縦書きの軸ラベルはsatoriで崩れやすいのでグラフの下にまとめて書く。
  axisLabel: string;
  dots: Dot[];
  me: Dot | null;
  accent: string;
  centerLines: boolean;
  corners?: { tl: string; tr: string; bl: string; br: string };
}) {
  const inner = CHART_SIZE - CHART_INSET * 2;
  const left = (x: number) => CHART_INSET + x * inner;
  const top = (y: number) => CHART_INSET + (1 - y) * inner;
  const cornerStyle = {
    position: "absolute" as const,
    fontSize: 15,
    color: "rgba(243,243,247,0.55)",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", fontSize: 22, color: "#ffffff", marginBottom: 10 }}>
        {caption}
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            position: "relative",
            width: CHART_SIZE,
            height: CHART_SIZE,
            borderRadius: 12,
            background: "rgba(255,255,255,0.05)",
            border: "2px solid rgba(255,255,255,0.14)",
          }}
        >
          {centerLines && (
            <div
              style={{
                position: "absolute",
                left: CHART_SIZE / 2 - 1,
                top: 0,
                width: 2,
                height: CHART_SIZE - 4,
                background: "rgba(255,255,255,0.22)",
              }}
            />
          )}
          {centerLines && (
            <div
              style={{
                position: "absolute",
                top: CHART_SIZE / 2 - 1,
                left: 0,
                height: 2,
                width: CHART_SIZE - 4,
                background: "rgba(255,255,255,0.22)",
              }}
            />
          )}
          {corners && <div style={{ ...cornerStyle, left: 10, top: 8 }}>{corners.tl}</div>}
          {corners && <div style={{ ...cornerStyle, right: 10, top: 8 }}>{corners.tr}</div>}
          {corners && <div style={{ ...cornerStyle, left: 10, bottom: 8 }}>{corners.bl}</div>}
          {corners && <div style={{ ...cornerStyle, right: 10, bottom: 8 }}>{corners.br}</div>}
          {dots.map((d, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: left(d.x) - 5,
                top: top(d.y) - 5,
                width: 10,
                height: 10,
                borderRadius: 999,
                background: d.color,
                opacity: 0.75,
              }}
            />
          ))}
          {me && (
            <div
              style={{
                position: "absolute",
                left: left(me.x) - 13,
                top: top(me.y) - 13,
                width: 26,
                height: 26,
                borderRadius: 999,
                background: me.color,
                border: "4px solid #ffffff",
                boxShadow: `0 0 0 5px ${accent}`,
              }}
            />
          )}
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 14, color: "rgba(243,243,247,0.6)", marginTop: 6 }}>
        {axisLabel}
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stat = await getRiotReportStatForShare(id).catch(() => null);

  const received = stat?.receivedTotal ?? 0;
  const made = stat?.madeTotal ?? 0;
  const { title, tone } = getReportCountTitle(received);
  const colors = TONE_COLORS[tone];
  const comparison = stat
    ? await getRiotReportComparison(
        received,
        made,
        asCountMap(stat.receivedByCategory),
        stat.summonerLevel,
        chatSummaryFromRow(stat),
      ).catch(() => null)
    : null;

  const quadrant = comparison?.quadrant ?? null;
  const perLevel = comparison?.perLevel ?? null;
  const myLean: ReportLean = quadrant?.lean ?? "none";

  const rankText = !comparison
    ? ""
    : comparison.topPercent === null
      ? `参加者 ${comparison.participants}人 集計中`
      : received === 0
        ? `参加者${comparison.participants}人中 通報0回`
        : `参加者${comparison.participants}人中 上位 ${comparison.topPercent}%`;
  // 絵文字はフォントに含まれないため、画像では名前だけ出す。
  const typeText = quadrant ? getTypeName(quadrant.type, quadrant.lean) : "";
  const per100Text =
    perLevel?.myPer100 != null ? `Lv${perLevel.myLevel} ・ Lv100あたり ${perLevel.myPer100}回` : "";

  // 4象限(横=通報した回数、縦=通報された回数)
  let quadrantDots: Dot[] = [];
  let quadrantMe: Dot | null = null;
  if (quadrant) {
    const axes = buildQuadrantAxes(quadrant.medianMade, quadrant.medianReceived, [
      [made, received],
      ...quadrant.points.map((p) => [p[0], p[1]] as [number, number]),
    ]);
    quadrantDots = quadrant.points.map(([x, y, lean]) => ({
      x: axes.x(x),
      y: axes.y(y),
      color: LEANS[lean].color,
    }));
    quadrantMe = { x: axes.x(made), y: axes.y(received), color: LEANS[myLean].color };
  }

  // 散布図(横=通報された回数、縦=レベル100あたり)
  let perLevelDots: Dot[] = [];
  let perLevelMe: Dot | null = null;
  if (perLevel && (perLevel.points.length > 0 || perLevel.myPer100 !== null)) {
    const axes = buildPerLevelAxes([
      ...(perLevel.myPer100 !== null ? [[received, perLevel.myPer100] as [number, number]] : []),
      ...perLevel.points.map((p) => [p[0], p[1]] as [number, number]),
    ]);
    perLevelDots = perLevel.points.map(([x, y, lean]) => ({
      x: axes.x(x),
      y: axes.y(y),
      color: LEANS[lean].color,
    }));
    perLevelMe =
      perLevel.myPer100 !== null
        ? { x: axes.x(received), y: axes.y(perLevel.myPer100), color: LEANS[myLean].color }
        : null;
  }

  // 小さいグラフの四隅に入るよう、象限名は短縮形にする。
  const corners = { tl: "うっかり", tr: "バチバチ", bl: "平和主義", br: "風紀委員" };
  // チャットの要約(絵文字はフォントに無いので使わない)。
  const chat = comparison?.chat.mine ?? null;
  const chatTiles = chat
    ? [
        { label: "発言した試合", value: `${chatRates(chat).activeRate}%` },
        { label: "1試合の発言", value: `${chatRates(chat).perGame}回` },
        { label: "強めの言葉", value: `${chat.harshMessages}回` },
      ]
    : [];
  const chatCaption = chat ? `チャット(直近${chat.games}試合)` : "";

  const texts = [
    "LOLWATCHLoL 通報された回数回称号タイプあなたは何回?lol-watch.com0123456789.%",
    "4象限レベルあたり通報した回数横縦・",
    title,
    rankText,
    typeText,
    per100Text,
    Object.values(corners).join(""),
    chatCaption,
    chatTiles.map((t) => t.label + t.value).join(""),
  ].join("");
  const fontData = await loadGoogleFontJP(texts, 900).catch(() => null);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: "44px 52px",
        color: "#f3f3f7",
        background: `radial-gradient(circle at 100% 0%, ${colors.glow}, transparent 55%), radial-gradient(circle at 0% 100%, rgba(52, 87, 213, 0.3), transparent 60%), linear-gradient(160deg, #0d1124 0%, #070912 100%)`,
        border: `6px solid ${colors.accent}`,
        ...(fontData ? { fontFamily: "NotoJP" } : {}),
      }}
    >
      {/* 左: 回数・称号・タイプ */}
      <div style={{ display: "flex", flexDirection: "column", width: 470 }}>
        <div style={{ display: "flex", fontSize: 24, color: colors.accent, letterSpacing: 6 }}>
          LOLWATCH
        </div>
        <div
          style={{ display: "flex", fontSize: 26, color: "rgba(243,243,247,0.75)", marginTop: 6 }}
        >
          LoL 通報された回数
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", marginTop: 2 }}>
          <span style={{ fontSize: 160, lineHeight: 1, letterSpacing: -6, color: "#ffffff" }}>
            {stat ? String(received) : "?"}
          </span>
          <span style={{ fontSize: 52, marginLeft: 10, marginBottom: 20 }}>回</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 6 }}>
          <span
            style={{
              display: "flex",
              fontSize: 22,
              padding: "4px 14px",
              borderRadius: 999,
              background: colors.accent,
              color: "#0b0d18",
            }}
          >
            称号
          </span>
          <span style={{ fontSize: 46, marginLeft: 14 }}>{title}</span>
        </div>
        {typeText && (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              fontSize: 24,
              marginTop: 16,
              padding: "6px 16px",
              whiteSpace: "nowrap",
              borderRadius: 12,
              border: `2px solid ${colors.accent}`,
            }}
          >
            タイプ: {typeText}
          </div>
        )}
        <div style={{ display: "flex", fontSize: 30, color: colors.accent, marginTop: 16 }}>
          {rankText}
        </div>
        {per100Text && (
          <div
            style={{ display: "flex", fontSize: 22, color: "rgba(243,243,247,0.8)", marginTop: 6 }}
          >
            {per100Text}
          </div>
        )}
        <div style={{ display: "flex", fontSize: 24, color: colors.accent, marginTop: "auto" }}>
          あなたは何回? lol-watch.com
        </div>
      </div>

      {/* 右: 4象限と散布図、その下にチャットの要約 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
          marginLeft: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <MiniChart
            caption="4象限"
            axisLabel="横: 通報した回数 ・ 縦: 通報された回数"
            dots={quadrantDots}
            me={quadrantMe}
            accent={colors.accent}
            centerLines
            corners={corners}
          />
          <MiniChart
            caption="レベルあたり"
            axisLabel="横: 通報された回数 ・ 縦: Lv100あたり"
            dots={perLevelDots}
            me={perLevelMe}
            accent={colors.accent}
            centerLines={false}
          />
        </div>
        {chat && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 18 }}>
            <div style={{ display: "flex", fontSize: 18, color: "rgba(243,243,247,0.65)" }}>
              {chatCaption}
            </div>
            <div style={{ display: "flex", marginTop: 8 }}>
              {chatTiles.map((t, i) => (
                <div
                  key={t.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flex: 1,
                    marginLeft: i === 0 ? 0 : 10,
                    padding: "8px 0",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <span style={{ fontSize: 16, color: "rgba(243,243,247,0.65)" }}>{t.label}</span>
                  <span style={{ fontSize: 30, color: "#ffffff" }}>{t.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    {
      ...size,
      fonts: fontData
        ? [{ name: "NotoJP", data: fontData, style: "normal", weight: 900 }]
        : undefined,
    },
  );
}
