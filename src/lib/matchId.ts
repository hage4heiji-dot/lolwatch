const RIOT_PLATFORM = (process.env.RIOT_PLATFORM ?? "jp1").toUpperCase();

// LoLクライアントの観戦者リンク等でコピーできる形式は "JP1_1234567890" のようなプレフィックス付きだが、
// 数字部分だけが渡された場合は設定済みプラットフォームを補って正規化する。
export function normalizeMatchId(input: string): string | null {
  const trimmed = input.trim().toUpperCase();
  if (/^[A-Z0-9]+_\d+$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d+$/.test(trimmed)) {
    return `${RIOT_PLATFORM}_${trimmed}`;
  }
  return null;
}
