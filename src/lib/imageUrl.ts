// 通報の証跡として、通報者が任意で添付する画像URL(外部の画像ホスティングサービスに
// 投稿してもらったものへのリンク)。img srcとしてそのまま描画するため、
// http/https以外(javascript: 等)は拒否する。
export const IMAGE_URL_MAX_LENGTH = 500;

export function isSafeImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
