import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { loadGoogleFontJP } from "@/lib/ogFont";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "lolwatchの通報履歴";
// プレイヤーごとに生成した画像を1時間キャッシュする。
export const revalidate = 3600;

const BRAND = "lolwatch";

export default async function Image({ params }: { params: Promise<{ puuid: string }> }) {
  const { puuid } = await params;

  const player = await prisma.player
    .findUnique({
      where: { puuid },
      select: {
        nameHistory: { where: { isCurrent: true }, take: 1, select: { riotIdName: true, riotIdTagLine: true } },
        reports: {
          where: { hiddenAt: null },
          select: {
            moderatorReviews: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { verdict: true },
            },
          },
        },
      },
    })
    .catch(() => null);

  const name = player?.nameHistory[0];
  const displayName = name ? `${name.riotIdName} #${name.riotIdTagLine}` : null;
  const reportCount = player?.reports.length ?? 0;
  const confirmedCount =
    player?.reports.filter((r) => r.moderatorReviews[0]?.verdict === "VIOLATION_CONFIRMED").length ?? 0;

  const subLabel = !displayName
    ? ""
    : reportCount === 0
      ? "通報履歴なし"
      : confirmedCount > 0
        ? `通報 ${reportCount}件 ・ うちモデレーター違反確認 ${confirmedCount}件`
        : `通報 ${reportCount}件`;

  const fontData = displayName
    ? await loadGoogleFontJP(`${BRAND}${displayName}${subLabel}`).catch(() => null)
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1c2036 100%)",
          color: "#ededed",
          // satoriはfontFamily:undefinedを渡されるとフォント解決時に例外を投げるため、
          // カスタムフォントが無い場合はキー自体を省略する。
          ...(fontData ? { fontFamily: "NotoJP" } : {}),
        }}
      >
        <div style={{ display: "flex", fontSize: 32, color: "#7c93ff", marginBottom: 28 }}>{BRAND}</div>
        <div style={{ display: "flex", fontSize: 60, fontWeight: 700, marginBottom: 24, maxWidth: 1040 }}>
          {displayName ?? BRAND}
        </div>
        {subLabel && <div style={{ display: "flex", fontSize: 34, color: "#9a9aa2" }}>{subLabel}</div>}
      </div>
    ),
    {
      ...size,
      fonts: fontData ? [{ name: "NotoJP", data: fontData, style: "normal", weight: 700 }] : undefined,
    },
  );
}
