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
  QUADRANTS,
  TONE_COLORS,
  type QuadrantKey,
  type ReportLean,
} from "@/lib/reportCountTitle";
import { buildPerLevelAxes, buildQuadrantAxes } from "@/lib/reportChartScale";
import { chatRates } from "@/lib/chatStats";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "LoLで通報された回数";
// 送り直した直後に共有されることが多いので、使い回しは1分程度にとどめる。
export const revalidate = 60;

const CHART_SIZE = 270;
const CHART_INSET = 18;
const MUTED = "rgba(243,243,247,0.62)";

type Dot = { x: number; y: number; color: string };

// next/og(satori)はSVGの対応が限定的なので、グラフは絶対配置のdivで描く。x,yは0〜1(0=左/下)。
function MiniChart({
  caption,
  axisLabel,
  dots,
  me,
  centerLines,
  quadrantFills,
  heat,
  corners,
}: {
  caption: string;
  // 「横: ○○ ・ 縦: ○○」。縦書きの軸ラベルはsatoriで崩れやすいのでグラフの下にまとめて書く。
  axisLabel: string;
  dots: Dot[];
  me: Dot | null;
  centerLines: boolean;
  // 4象限の色(左上・右上・左下・右下)。自分の象限は濃くする。
  quadrantFills?: { tl: string; tr: string; bl: string; br: string };
  // 右上ほど赤くする背景(レベルあたり用)。
  heat?: boolean;
  corners?: { tl: string; tr: string; bl: string; br: string };
}) {
  const inner = CHART_SIZE - CHART_INSET * 2;
  const left = (x: number) => CHART_INSET + x * inner;
  const top = (y: number) => CHART_INSET + (1 - y) * inner;
  const half = CHART_SIZE / 2;
  const cornerStyle = {
    position: "absolute" as const,
    fontSize: 14,
    color: "rgba(243,243,247,0.7)",
  };
  // 「あなた」タグは点の上。上端に近いときは下に出し、左右は枠からはみ出さないよう寄せる。
  const tagLeft = me ? Math.min(Math.max(left(me.x) - 32, 2), CHART_SIZE - 66) : 0;
  const tagTop = me ? (top(me.y) < 44 ? top(me.y) + 18 : top(me.y) - 42) : 0;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px 14px 10px",
        borderRadius: 20,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div style={{ display: "flex", fontSize: 20, color: "#ffffff", marginBottom: 8 }}>
        {caption}
      </div>
      <div
        style={{
          display: "flex",
          position: "relative",
          width: CHART_SIZE,
          height: CHART_SIZE,
          borderRadius: 14,
          overflow: "hidden",
          background: heat
            ? "linear-gradient(45deg, rgba(79,209,165,0.16) 0%, rgba(255,159,67,0.12) 55%, rgba(255,90,95,0.42) 100%)"
            : "rgba(10,12,24,0.6)",
          border: "2px solid rgba(255,255,255,0.16)",
        }}
      >
        {quadrantFills && (
          <>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: half,
                height: half,
                background: quadrantFills.tl,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: half,
                top: 0,
                width: half,
                height: half,
                background: quadrantFills.tr,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                top: half,
                width: half,
                height: half,
                background: quadrantFills.bl,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: half,
                top: half,
                width: half,
                height: half,
                background: quadrantFills.br,
              }}
            />
          </>
        )}
        {!centerLines &&
          [0.25, 0.5, 0.75].map((g) => (
            <div
              key={`v${g}`}
              style={{
                position: "absolute",
                left: CHART_SIZE * g,
                top: 0,
                width: 1,
                height: CHART_SIZE,
                background: "rgba(255,255,255,0.07)",
              }}
            />
          ))}
        {!centerLines &&
          [0.25, 0.5, 0.75].map((g) => (
            <div
              key={`h${g}`}
              style={{
                position: "absolute",
                top: CHART_SIZE * g,
                left: 0,
                height: 1,
                width: CHART_SIZE,
                background: "rgba(255,255,255,0.07)",
              }}
            />
          ))}
        {centerLines && (
          <div
            style={{
              position: "absolute",
              left: half - 1,
              top: 0,
              width: 2,
              height: CHART_SIZE,
              background: "rgba(255,255,255,0.3)",
            }}
          />
        )}
        {centerLines && (
          <div
            style={{
              position: "absolute",
              top: half - 1,
              left: 0,
              height: 2,
              width: CHART_SIZE,
              background: "rgba(255,255,255,0.3)",
            }}
          />
        )}
        {corners && <div style={{ ...cornerStyle, left: 9, top: 7 }}>{corners.tl}</div>}
        {corners && <div style={{ ...cornerStyle, right: 9, top: 7 }}>{corners.tr}</div>}
        {corners && <div style={{ ...cornerStyle, left: 9, bottom: 7 }}>{corners.bl}</div>}
        {corners && <div style={{ ...cornerStyle, right: 9, bottom: 7 }}>{corners.br}</div>}
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
              boxShadow: `0 0 8px ${d.color}`,
              opacity: 0.85,
            }}
          />
        ))}
        {me && (
          <div
            style={{
              position: "absolute",
              left: left(me.x) - 18,
              top: top(me.y) - 18,
              width: 36,
              height: 36,
              borderRadius: 999,
              border: `2px solid ${me.color}`,
              opacity: 0.6,
            }}
          />
        )}
        {me && (
          <div
            style={{
              position: "absolute",
              left: left(me.x) - 11,
              top: top(me.y) - 11,
              width: 22,
              height: 22,
              borderRadius: 999,
              background: me.color,
              border: "4px solid #ffffff",
              boxShadow: `0 0 16px ${me.color}`,
            }}
          />
        )}
        {me && (
          <div
            style={{
              position: "absolute",
              left: tagLeft,
              top: tagTop,
              display: "flex",
              justifyContent: "center",
              width: 64,
              fontSize: 15,
              padding: "2px 0",
              borderRadius: 999,
              background: me.color,
              color: "#0b0d18",
            }}
          >
            あなた
          </div>
        )}
      </div>
      <div style={{ display: "flex", fontSize: 13, color: MUTED, marginTop: 7 }}>{axisLabel}</div>
    </div>
  );
}

// 左側の小さな指標タイル(通報した回数など)。
function StatTile({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: "9px 14px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.13)",
      }}
    >
      <span style={{ fontSize: 16, color: MUTED }}>{label}</span>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <span style={{ fontSize: 32, lineHeight: 1.15, color: color ?? "#ffffff" }}>{value}</span>
        {sub && <span style={{ fontSize: 15, marginLeft: 6, color: MUTED }}>{sub}</span>}
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

  // 絵文字はフォントに含まれないため、画像では名前だけ出す。
  const typeText = quadrant ? getTypeName(quadrant.type, quadrant.lean) : "";

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
  // 象限の色。自分のいる象限だけ濃くする。
  const fill = (key: QuadrantKey) =>
    `${QUADRANTS[key].color}${quadrant?.type === key ? "55" : "1c"}`;
  const quadrantFills = {
    tl: fill("oops"),
    tr: fill("clash"),
    bl: fill("peace"),
    br: fill("guardian"),
  };
  const typeColor = quadrant ? QUADRANTS[quadrant.type].color : colors.accent;

  // チャットの要約(絵文字はフォントに無いので使わない)。
  const chat = comparison?.chat.mine ?? null;
  const chatTiles = chat
    ? [
        { label: "発言した試合", value: `${chatRates(chat).activeRate}%`, color: "#7cb8ff" },
        { label: "1試合の発言", value: `${chatRates(chat).perGame}回`, color: "#d68bff" },
        { label: "強めの言葉", value: `${chat.harshMessages}回`, color: "#ff7a9a" },
      ]
    : [];
  const chatCaption = chat ? `チャット ・ 直近${chat.games}試合` : "";

  const rankValue =
    !comparison || comparison.topPercent === null
      ? "集計中"
      : received === 0
        ? "0回"
        : `上位${comparison.topPercent}%`;
  const participantsText = comparison ? `参加者 ${comparison.participants}人` : "";
  const levelValue = perLevel?.myPer100 != null ? `${perLevel.myPer100}回` : "-";
  const levelLabel = "Lv100あたり";
  const levelSub = perLevel?.myLevel ? `Lv${perLevel.myLevel}` : undefined;

  const texts = [
    "LOLWATCHLoLで通報された回数回称号タイプあなたは何回?lol-watch.comRiotのデータで診断0123456789.%+-",
    "4象限レベルあたり通報した回数横縦・順位参加者人集計中上位",
    title,
    typeText,
    levelLabel,
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
        flexDirection: "column",
        padding: "34px 44px 26px",
        color: "#f3f3f7",
        background: `radial-gradient(circle at 100% 0%, ${colors.glow}, transparent 50%), radial-gradient(circle at 0% 100%, rgba(52, 87, 213, 0.32), transparent 55%), linear-gradient(160deg, #0f1328 0%, #070912 100%)`,
        ...(fontData ? { fontFamily: "NotoJP" } : {}),
      }}
    >
      {/* 上端のアクセントライン */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1200,
          height: 8,
          background: `linear-gradient(90deg, ${colors.accent}, ${typeColor})`,
        }}
      />
      <div style={{ display: "flex", flex: 1 }}>
        {/* 左: 回数・称号・タイプ・指標 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 440,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 22, color: colors.accent, letterSpacing: 6 }}>LOLWATCH</span>
            <span
              style={{
                fontSize: 15,
                marginLeft: 12,
                padding: "3px 10px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.25)",
                color: MUTED,
              }}
            >
              Riotのデータで診断
            </span>
          </div>
          <div
            style={{ display: "flex", fontSize: 24, color: "rgba(243,243,247,0.8)", marginTop: 10 }}
          >
            LoLで通報された回数
            {levelSub && <span style={{ marginLeft: 12, color: MUTED }}>・ {levelSub}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <span
              style={{
                fontSize: 150,
                lineHeight: 1,
                letterSpacing: -6,
                color: "#ffffff",
                textShadow: `0 0 40px ${colors.glow}`,
              }}
            >
              {stat ? String(received) : "?"}
            </span>
            <span style={{ fontSize: 48, marginLeft: 10, marginBottom: 18 }}>回</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 2 }}>
            <span
              style={{
                display: "flex",
                fontSize: 20,
                padding: "4px 12px",
                borderRadius: 999,
                background: colors.accent,
                color: "#0b0d18",
              }}
            >
              称号
            </span>
            <span style={{ fontSize: 42, marginLeft: 12 }}>{title}</span>
          </div>
          {typeText && (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                fontSize: 22,
                marginTop: 12,
                padding: "5px 14px",
                whiteSpace: "nowrap",
                borderRadius: 12,
                color: typeColor,
                background: `${typeColor}22`,
                border: `2px solid ${typeColor}`,
              }}
            >
              タイプ: {typeText}
            </div>
          )}
          <div style={{ display: "flex", marginTop: 16 }}>
            <StatTile label="通報した回数" value={stat ? `${made}回` : "-"} color="#7cb8ff" />
            <div style={{ display: "flex", width: 10 }} />
            <StatTile label={participantsText || "順位"} value={rankValue} color={colors.accent} />
            <div style={{ display: "flex", width: 10 }} />
            <StatTile label={levelLabel} value={levelValue} />
          </div>
        </div>

        {/* 右: 4象限と散布図、その下にチャットの要約 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            marginLeft: 26,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <MiniChart
              caption="4象限"
              axisLabel="横: 通報した回数 ・ 縦: 通報された回数"
              dots={quadrantDots}
              me={quadrantMe}
              centerLines
              quadrantFills={quadrantFills}
              corners={corners}
            />
            <MiniChart
              caption="レベルあたり"
              axisLabel="横: 通報された回数 ・ 縦: Lv100あたり"
              dots={perLevelDots}
              me={perLevelMe}
              centerLines={false}
              heat
            />
          </div>
          {chat && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
              <div style={{ display: "flex", fontSize: 16, color: MUTED }}>{chatCaption}</div>
              <div style={{ display: "flex", marginTop: 6 }}>
                {chatTiles.map((t, i) => (
                  <div
                    key={t.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flex: 1,
                      marginLeft: i === 0 ? 0 : 10,
                      padding: "8px 14px",
                      borderRadius: 12,
                      background: `${t.color}14`,
                      border: `1px solid ${t.color}55`,
                    }}
                  >
                    <span style={{ fontSize: 15, color: MUTED }}>{t.label}</span>
                    <span style={{ fontSize: 26, color: t.color }}>{t.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 下端: 呼びかけとURL */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <span style={{ fontSize: 24, color: "#ffffff" }}>あなたは何回?</span>
        <span style={{ fontSize: 24, color: colors.accent }}>lol-watch.com</span>
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
