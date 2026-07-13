import Link from "next/link";
import {
  findReportedPlayers,
  REPORTED_PLAYERS_SORT_LABELS,
  ReportedPlayersSort,
  ReportedPlayersVerdictFilter,
} from "@/lib/playerProfile";
import { VERDICT_LABELS, VERDICT_BADGE_CLASS, VERDICT_ICONS } from "@/lib/moderatorVerdicts";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/reportCategories";
import { ModeratorVerdict, ReportCategory } from "@/generated/prisma";
import {
  DEFAULT_PERIOD_FILTER,
  PERIOD_FILTER_LABELS,
  isPeriodFilter,
  type PeriodFilter,
} from "@/lib/periodFilter";

const PAGE_SIZE = 20;
const DEFAULT_SORT: ReportedPlayersSort = "reportCount";
const VERDICT_FILTER_VALUES: ReportedPlayersVerdictFilter[] = [
  "UNREVIEWED",
  ...(Object.keys(VERDICT_LABELS) as ModeratorVerdict[]),
];

function isReportCategory(value: string): value is ReportCategory {
  return value in CATEGORY_LABELS;
}

function isVerdictFilter(value: string): value is ReportedPlayersVerdictFilter {
  return (VERDICT_FILTER_VALUES as string[]).includes(value);
}

function isSort(value: string): value is ReportedPlayersSort {
  return value in REPORTED_PLAYERS_SORT_LABELS;
}

function buildPageHref(
  page: number,
  params: {
    q?: string;
    category?: string;
    verdict?: string;
    period: PeriodFilter;
    sort: ReportedPlayersSort;
  },
) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.verdict) search.set("verdict", params.verdict);
  if (params.period !== DEFAULT_PERIOD_FILTER) search.set("period", params.period);
  if (params.sort !== DEFAULT_SORT) search.set("sort", params.sort);
  if (page > 1) search.set("page", String(page));
  const qs = search.toString();
  return qs ? `/players?${qs}` : "/players";
}

export default async function ReportedPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    category?: string;
    verdict?: string;
    period?: string;
    sort?: string;
  }>;
}) {
  const {
    page: pageParam,
    q,
    category: categoryParam,
    verdict: verdictParam,
    period: periodParam,
    sort: sortParam,
  } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const query = q?.trim() || undefined;
  const category = categoryParam && isReportCategory(categoryParam) ? categoryParam : undefined;
  const verdict = verdictParam && isVerdictFilter(verdictParam) ? verdictParam : undefined;
  const period = periodParam && isPeriodFilter(periodParam) ? periodParam : DEFAULT_PERIOD_FILTER;
  const sort = sortParam && isSort(sortParam) ? sortParam : DEFAULT_SORT;

  const { players, totalCount } = await findReportedPlayers({
    page,
    pageSize: PAGE_SIZE,
    query,
    category,
    verdict,
    period,
    sort,
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = Boolean(
    query || category || verdict || period !== DEFAULT_PERIOD_FILTER || sort !== DEFAULT_SORT,
  );

  return (
    <div>
      <h1>通報されているユーザー一覧</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
        {REPORTED_PLAYERS_SORT_LABELS[sort]}に表示しています(全{totalCount}件)。「モデレーター評価」バッジは、運営が実際にリプレイ等を確認した上での判定です。バッジのない対象は一般ユーザーからの未検証の通報のみです。
      </p>

      <form style={{ marginBottom: "1.5rem" }}>
        <div className="form-row" style={{ alignItems: "flex-end" }}>
          <div className="form-field">
            <label htmlFor="q">Riot ID(名前)で検索</label>
            <input type="text" id="q" name="q" defaultValue={query ?? ""} placeholder="例: Faker" />
          </div>
          <div className="form-field">
            <label htmlFor="category">通報カテゴリ</label>
            <select id="category" name="category" defaultValue={category ?? ""}>
              <option value="">すべて</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {CATEGORY_ICONS[value as ReportCategory]} {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="verdict">モデレーター評価</label>
            <select id="verdict" name="verdict" defaultValue={verdict ?? ""}>
              <option value="">すべて</option>
              <option value="UNREVIEWED">未評価のみ</option>
              {Object.entries(VERDICT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {VERDICT_ICONS[value as ModeratorVerdict]} {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="period">期間</label>
            <select id="period" name="period" defaultValue={period}>
              {Object.entries(PERIOD_FILTER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="sort">並び替え</label>
            <select id="sort" name="sort" defaultValue={sort}>
              {Object.entries(REPORTED_PLAYERS_SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn" type="submit">
            検索
          </button>
          {hasFilters && (
            <Link className="btn btn-secondary" href="/players">
              条件をクリア
            </Link>
          )}
        </div>
      </form>

      {players.length === 0 ? (
        <p className="muted">
          {hasFilters
            ? "条件に一致するプレイヤーが見つかりませんでした。"
            : "まだ通報はありません。"}
        </p>
      ) : (
        players.map((player) => {
          const name = player.nameHistory[0];
          const latestReview = player.latestReview;
          return (
            <div
              className="card"
              key={player.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <div>
                <Link href={`/players/${player.puuid}`}>
                  {name ? `${name.riotIdName} #${name.riotIdTagLine}` : player.puuid}
                </Link>
                <p className="muted" style={{ marginTop: "0.35rem" }}>
                  通報件数: {player._count.reports}
                </p>
              </div>
              {latestReview && (
                <span className={VERDICT_BADGE_CLASS[latestReview.verdict]}>
                  {VERDICT_ICONS[latestReview.verdict]} {VERDICT_LABELS[latestReview.verdict]}
                </span>
              )}
            </div>
          );
        })
      )}

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "1.5rem",
          }}
        >
          {page > 1 ? (
            <Link className="btn btn-secondary" href={buildPageHref(page - 1, { q: query, category, verdict, period, sort })}>
              前へ
            </Link>
          ) : (
            <span />
          )}
          <span className="muted">
            {page} / {totalPages} ページ
          </span>
          {page < totalPages ? (
            <Link className="btn btn-secondary" href={buildPageHref(page + 1, { q: query, category, verdict, period, sort })}>
              次へ
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
