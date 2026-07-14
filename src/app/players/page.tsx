import Link from "next/link";
import {
  findReportedPlayers,
  REPORTED_PLAYERS_SORT_LABELS,
  ReportedPlayersSort,
  SortDirection,
} from "@/lib/playerProfile";
import { VERDICT_LABELS, VERDICT_BADGE_CLASS, VERDICT_ICONS } from "@/lib/moderatorVerdicts";
import {
  DEFAULT_PERIOD_FILTER,
  PERIOD_FILTER_LABELS,
  isPeriodFilter,
  type PeriodFilter,
} from "@/lib/periodFilter";

const PAGE_SIZE = 20;
const DEFAULT_SORT: ReportedPlayersSort = "reportCount";
const DEFAULT_DIRECTION: SortDirection = "desc";

function isSort(value: string): value is ReportedPlayersSort {
  return value in REPORTED_PLAYERS_SORT_LABELS;
}

function isDirection(value: string): value is SortDirection {
  return value === "asc" || value === "desc";
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

interface FilterParams {
  q?: string;
  period: PeriodFilter;
  sort: ReportedPlayersSort;
  direction: SortDirection;
}

function buildHref(params: FilterParams & { page?: number }) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.period !== DEFAULT_PERIOD_FILTER) search.set("period", params.period);
  if (params.sort !== DEFAULT_SORT) search.set("sort", params.sort);
  if (params.direction !== DEFAULT_DIRECTION) search.set("dir", params.direction);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return qs ? `/players?${qs}` : "/players";
}

// 列見出しクリックでのソート切り替え。同じ列を再クリックすると昇順/降順を反転する。
function SortableHeader({
  label,
  column,
  filters,
}: {
  label: string;
  column: ReportedPlayersSort;
  filters: FilterParams;
}) {
  const isActive = filters.sort === column;
  const nextDirection: SortDirection = isActive && filters.direction === "desc" ? "asc" : "desc";
  const href = buildHref({ ...filters, sort: column, direction: nextDirection });

  return (
    <th>
      <Link href={href} className={`sortable-header${isActive ? " active" : ""}`}>
        {label}
        {isActive && <span className="sort-arrow">{filters.direction === "desc" ? " ▼" : " ▲"}</span>}
      </Link>
    </th>
  );
}

export default async function ReportedPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    period?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { page: pageParam, q, period: periodParam, sort: sortParam, dir: dirParam } =
    await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const query = q?.trim() || undefined;
  const period = periodParam && isPeriodFilter(periodParam) ? periodParam : DEFAULT_PERIOD_FILTER;
  const sort = sortParam && isSort(sortParam) ? sortParam : DEFAULT_SORT;
  const direction = dirParam && isDirection(dirParam) ? dirParam : DEFAULT_DIRECTION;

  const { players, totalCount } = await findReportedPlayers({
    page,
    pageSize: PAGE_SIZE,
    query,
    period,
    sort,
    direction,
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = Boolean(query || period !== DEFAULT_PERIOD_FILTER || sort !== DEFAULT_SORT);
  const filters: FilterParams = { q: query, period, sort, direction };

  return (
    <div>
      <h1>通報されているユーザー一覧</h1>
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        {REPORTED_PLAYERS_SORT_LABELS[sort]}({direction === "desc" ? "降順" : "昇順"})・全{totalCount}件
      </p>
      <p className="muted" style={{ marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        「モデレーター評価」バッジは、運営が実際にリプレイ等を確認した上での判定です。バッジのない対象は一般ユーザーからの未検証の通報のみです。列見出しをクリックすると並び替えられます。カテゴリや評価状態で絞り込みたい場合は
        <Link href="/reports">通報一覧</Link>
        をご利用ください。
      </p>

      <form style={{ marginBottom: "1.5rem" }}>
        <div className="form-row" style={{ alignItems: "flex-end" }}>
          <div className="form-field">
            <label htmlFor="q">Riot ID(名前)で検索</label>
            <input type="text" id="q" name="q" defaultValue={query ?? ""} placeholder="例: Faker" />
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
        </div>
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={direction} />
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
        <div className="empty-state">
          <p>
            {hasFilters
              ? "条件に一致するプレイヤーが見つかりませんでした。"
              : "まだ通報はありません。"}
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Riot ID</th>
                <SortableHeader label="通報件数" column="reportCount" filters={filters} />
                <SortableHeader label="最新の通報日時" column="newest" filters={filters} />
                <th>モデレーター評価</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, i) => {
                const name = player.nameHistory[0];
                const latestReview = player.latestReview;
                return (
                  <tr key={player.id}>
                    <td>
                      <span className="rank-badge">{(page - 1) * PAGE_SIZE + i + 1}</span>
                    </td>
                    <td>
                      <Link href={`/players/${player.puuid}`}>
                        {name ? `${name.riotIdName} #${name.riotIdTagLine}` : player.puuid}
                      </Link>
                    </td>
                    <td>{player.reportCount}</td>
                    <td className="muted">
                      {player.latestReportAt ? formatDateTime(player.latestReportAt) : "-"}
                    </td>
                    <td>
                      {latestReview ? (
                        <span className={VERDICT_BADGE_CLASS[latestReview.verdict]}>
                          {VERDICT_ICONS[latestReview.verdict]} {VERDICT_LABELS[latestReview.verdict]}
                        </span>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
            <Link className="btn btn-secondary" href={buildHref({ ...filters, page: page - 1 })}>
              前へ
            </Link>
          ) : (
            <span />
          )}
          <span className="muted">
            {page} / {totalPages} ページ
          </span>
          {page < totalPages ? (
            <Link className="btn btn-secondary" href={buildHref({ ...filters, page: page + 1 })}>
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
