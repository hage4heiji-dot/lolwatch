// リプレイに映らないチャット等の証跡として、通報者が任意で添付する参考URL
// (X投稿・YouTube動画・imgur画像等、種類は問わない)。href としてそのまま
// 描画するため、http/https以外(javascript: 等)は拒否する。
export const REFERENCE_URL_MAX_LENGTH = 500;

export function isSafeReferenceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
