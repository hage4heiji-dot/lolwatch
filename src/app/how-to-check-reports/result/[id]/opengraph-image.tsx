import { ImageResponse } from "next/og";
import { loadGoogleFontJP } from "@/lib/ogFont";
import { getRiotReportComparison, getRiotReportStatForShare } from "@/lib/riotReportStats";
import { getReportCountTitle, topCategory, TONE_COLORS } from "@/lib/reportCountTitle";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "LoLで通報された回数";
// 順位は参加者の増減で少しずつ変わるが、共有画像としては10分程度のずれで十分。
export const revalidate = 600;

function asCounts(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).filter((e): e is [string, number] => typeof e[1] === "number"),
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stat = await getRiotReportStatForShare(id).catch(() => null);

  const received = stat?.receivedTotal ?? 0;
  const { title, tone } = getReportCountTitle(received);
  const colors = TONE_COLORS[tone];
  const comparison = stat ? await getRiotReportComparison(received).catch(() => null) : null;
  const top = stat ? topCategory(asCounts(stat.receivedByCategory)) : null;

  const rankText = !comparison
    ? ""
    : comparison.topPercent === null
      ? `参加者 ${comparison.participants}人 集計中`
      : received === 0
        ? `参加者${comparison.participants}人中 通報0回`
        : `参加者${comparison.participants}人中 上位 ${comparison.topPercent}%`;
  const topText = top ? `最も多い理由: ${top.label} ${top.count}回` : "";

  const texts = `LOLWATCHLoL 通報された回数回称号${title}${rankText}${topText}あなたは何回?lol-watch.com0123456789`;
  const fontData = await loadGoogleFontJP(texts, 900).catch(() => null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "64px 80px",
          color: "#f3f3f7",
          background: `radial-gradient(circle at 100% 0%, ${colors.glow}, transparent 55%), radial-gradient(circle at 0% 100%, rgba(52, 87, 213, 0.3), transparent 60%), linear-gradient(160deg, #0d1124 0%, #070912 100%)`,
          border: `6px solid ${colors.accent}`,
          ...(fontData ? { fontFamily: "NotoJP" } : {}),
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28 }}>
            <span style={{ color: colors.accent, letterSpacing: 6 }}>LOLWATCH</span>
            <span style={{ color: "rgba(243,243,247,0.75)" }}>LoL 通報された回数</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", marginTop: 10 }}>
            <span style={{ fontSize: 230, lineHeight: 1, letterSpacing: -8, color: "#ffffff" }}>
              {stat ? String(received) : "?"}
            </span>
            <span style={{ fontSize: 64, marginLeft: 12, marginBottom: 28 }}>回</span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginLeft: "auto",
                marginBottom: 30,
                alignItems: "flex-end",
              }}
            >
              <span
                style={{
                  display: "flex",
                  fontSize: 26,
                  padding: "6px 18px",
                  borderRadius: 999,
                  background: colors.accent,
                  color: "#0b0d18",
                }}
              >
                称号
              </span>
              <span style={{ fontSize: 64, marginTop: 12 }}>{title}</span>
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 44, color: colors.accent, marginTop: 8 }}>
            {rankText}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "auto",
              paddingTop: 22,
              borderTop: "2px solid rgba(255,255,255,0.12)",
              fontSize: 30,
            }}
          >
            <span style={{ color: "rgba(243,243,247,0.8)" }}>{topText}</span>
            <span style={{ color: colors.accent }}>あなたは何回? lol-watch.com</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData ? [{ name: "NotoJP", data: fontData, style: "normal", weight: 900 }] : undefined,
    },
  );
}
