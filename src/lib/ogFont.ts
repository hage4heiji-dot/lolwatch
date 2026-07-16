// next/ogのImageResponse(satori)は既定フォントが日本語グリフを含まないため、
// Google FontsのCSS APIから使用文字だけのサブセットを取得して埋め込む。
// css2 APIはUser-Agentによって配信フォーマットを変えるが、fetch()の既定UAでは
// truetype/opentype形式のURLが返る(satoriがwoff2を解釈できないため)。
export async function loadGoogleFontJP(text: string, weight = 700): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encodeURIComponent(text)}`;
  const cssRes = await fetch(cssUrl);
  if (!cssRes.ok) {
    throw new Error(`Google Fonts CSSの取得に失敗しました (status: ${cssRes.status})`);
  }
  const css = await cssRes.text();
  const match = css.match(/src: url\(([^)]+)\) format\('(opentype|truetype)'\)/);
  if (!match) {
    throw new Error("Noto Sans JPのフォントURLがCSSから見つかりませんでした");
  }
  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) {
    throw new Error(`フォントファイルの取得に失敗しました (status: ${fontRes.status})`);
  }
  return fontRes.arrayBuffer();
}
