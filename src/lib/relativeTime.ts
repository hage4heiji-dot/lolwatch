// 「3分前」「2時間前」のような相対表記。ランク参加監視の最終チェック時刻の表示用。
export function formatRelativeTime(date: Date, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60000));
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}
