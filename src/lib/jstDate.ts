// サーバー(コンテナ)のタイムゾーン設定に関わらず、日本時間基準で日付計算を行うための共通ヘルパー。
const JST_TIME_ZONE = "Asia/Tokyo";

// 日付を"YYYY-MM-DD"形式のJST日付キーに変換する。
export function toJstDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// "YYYY-MM-DD"のJST日付キーが指す0時0分0秒(JST)に対応するUTC上のDateを返す。
// 日本はDSTが無いため、この基準時刻からのミリ秒単位の加減算が常に正確な暦日ずれになる。
export function jstMidnightUtc(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+09:00`);
}

// 現在時刻からJSTの今日の0時0分0秒(UTC上のDate)を返す。
export function todayJstMidnightUtc(): Date {
  return jstMidnightUtc(toJstDateKey(new Date()));
}
