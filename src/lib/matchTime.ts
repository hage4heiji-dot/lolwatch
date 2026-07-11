export function formatMatchTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// "mm:ss" または "m:ss" 形式の文字列を秒数に変換する。不正な形式はnullを返す。
export function parseMatchTime(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = /^(\d+):([0-5]?\d)$/.exec(trimmed);
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return minutes * 60 + seconds;
}
