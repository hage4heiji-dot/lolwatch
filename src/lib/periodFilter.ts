import { todayJstMidnightUtc } from "@/lib/jstDate";

// 通報一覧・統計ダッシュボードで共通して使う期間フィルタ。
export type PeriodFilter = "week" | "month" | "all";

export const DEFAULT_PERIOD_FILTER: PeriodFilter = "week";

export const PERIOD_FILTER_LABELS: Record<PeriodFilter, string> = {
  week: "直近1週間",
  month: "直近1か月",
  all: "全期間",
};

const PERIOD_FILTER_DAYS: Record<Exclude<PeriodFilter, "all">, number> = {
  week: 7,
  month: 30,
};

export function isPeriodFilter(value: string): value is PeriodFilter {
  return value === "week" || value === "month" || value === "all";
}

// 期間の起点日を返す。"all"の場合はnull(絞り込みなし)。JST基準の0時を起点にする。
export function periodFilterSince(period: PeriodFilter): Date | null {
  if (period === "all") return null;
  const days = PERIOD_FILTER_DAYS[period];
  return new Date(todayJstMidnightUtc().getTime() - days * 24 * 60 * 60 * 1000);
}
