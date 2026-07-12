// リプレイに映らないチャット等の証跡として、通報者が任意で添付する動画URL。
// href としてそのまま描画するため、http/https以外(javascript: 等)は拒否する。
export const VIDEO_URL_MAX_LENGTH = 500;

export function isSafeVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
