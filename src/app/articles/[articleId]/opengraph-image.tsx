import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { loadGoogleFontJP } from "@/lib/ogFont";
import { ARTICLE_KIND_LABELS, ARTICLE_KIND_ICONS } from "@/lib/articleKind";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "lolwatchの記事サムネイル";
// 記事は公開後に編集されうるが、頻繁ではないため1時間キャッシュで十分とする。
export const revalidate = 3600;

const BRAND = "lolwatch";

// 種別ごとのアクセントカラー。炎上案件は赤系、行為判定は既存サイトのブランド色(青紫)に寄せる。
const ACCENT_BY_KIND: Record<string, string> = {
  INCIDENT: "#ff6b4a",
  JUDGMENT: "#7c93ff",
};

export default async function Image({ params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;

  const article = await prisma.article
    .findUnique({
      where: { id: articleId },
      select: { title: true, kind: true, tags: true },
    })
    .catch(() => null);

  const title = article?.title ?? BRAND;
  const kindLabel = article ? ARTICLE_KIND_LABELS[article.kind] : "";
  const kindIcon = article ? ARTICLE_KIND_ICONS[article.kind] : "";
  const accent = article ? ACCENT_BY_KIND[article.kind] : "#7c93ff";
  const tags = article?.tags.slice(0, 3) ?? [];

  // タイトルが長いほど1行あたりの文字数が増えるため、収まりを見てフォントサイズを落とす
  // (YouTubeサムネイルのように、短い煽り文句ほど大きく見せたい)。
  const titleFontSize = title.length > 40 ? 48 : title.length > 24 ? 56 : 68;

  const fontData = await loadGoogleFontJP(`${BRAND}${title}${kindLabel}${tags.join("")}`).catch(
    () => null,
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1c2036 100%)",
          color: "#ededed",
          ...(fontData ? { fontFamily: "NotoJP" } : {}),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 32, color: accent, fontWeight: 700 }}>{BRAND}</div>
          {kindLabel && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 28,
                padding: "10px 24px",
                borderRadius: 999,
                background: `${accent}26`,
                color: accent,
                fontWeight: 700,
              }}
            >
              {kindIcon} {kindLabel}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: titleFontSize,
            fontWeight: 700,
            lineHeight: 1.35,
            maxWidth: 1050,
          }}
        >
          {title}
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {tags.map((tag) => (
            <div
              key={tag}
              style={{
                display: "flex",
                fontSize: 26,
                padding: "8px 20px",
                borderRadius: 999,
                background: "#ffffff14",
                color: "#c9c9d4",
              }}
            >
              #{tag}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData ? [{ name: "NotoJP", data: fontData, style: "normal", weight: 700 }] : undefined,
    },
  );
}
