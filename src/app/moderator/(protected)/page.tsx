import Link from "next/link";
import {
  findReportedPlayers,
  ReportedPlayersVerdictFilter,
  ReportedPlayersSort,
  SortDirection,
} from "@/lib/playerProfile";
import { prisma } from "@/lib/prisma";
import { VERDICT_LABELS, VERDICT_ICONS, VERDICT_BADGE_CLASS } from "@/lib/moderatorVerdicts";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/reportCategories";
import { ModeratorVerdict, ReportCategory } from "@/generated/prisma";

const PAGE_SIZE = 20;
const DEFAULT_VERDICT_FILTER: ReportedPlayersVerdictFilter = "UNREVIEWED";
const DEFAULT_SORT: ReportedPlayersSort = "reportCount";
const DEFAULT_DIRECTION: SortDirection = "desc";
const VERDICT_FILTER_VALUES: ReportedPlayersVerdictFilter[] = [
  "UNREVIEWED",
  ...(Object.keys(VERDICT_LABELS) as ModeratorVerdict[]),
];

// 通報状況を毎回集計するため、ビルド時の静的プリレンダー対象から外す。
export const dynamic = "force-dynamic";

function isReportCategory(value: string): value is ReportCategory {
  return value in CATEGORY_LABELS;
}

function isVerdictFilter(value: string): value is ReportedPlayersVerdictFilter {
  return (VERDICT_FILTER_VALUES as string[]).includes(value);
}

function isSort(value: string): value is ReportedPlayersSort {
  return value === "reportCount" || value === "newest";
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
  category?: ReportCategory;
  // "すべて"の明示的な選択(空文字)とパラメータ省略(デフォルト)を区別するため、
  // パース済みのverdictではなく生のクエリ文字列を保持する。
  verdictParam?: string;
  moderatorId?: string;
  sort: ReportedPlayersSort;
  direction: SortDirection;
}

function buildHref(params: FilterParams & { page?: number }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category) sp.set("category", params.category);
  if (params.verdictParam !== undefined) sp.set("verdict", params.verdictParam);
  if (params.moderatorId) sp.set("moderatorId", params.moderatorId);
  if (params.sort !== DEFAULT_SORT) sp.set("sort", params.sort);
  if (params.direction !== DEFAULT_DIRECTION) sp.set("dir", params.direction);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/moderator?${qs}` : "/moderator";
}

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

export default async function ModeratorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    category?: string;
    verdict?: string;
    moderatorId?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const {
    page: pageParam,
    q,
    category: categoryParam,
    verdict: verdictParam,
    moderatorId: moderatorIdParam,
    sort: sortParam,
    dir: dirParam,
  } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const query = q?.trim() || undefined;
  const category = categoryParam && isReportCategory(categoryParam) ? categoryParam : undefined;
  // クエリパラメータが無い初回表示時のみ、デフォルトで未評価のみを表示する。
  // 「すべて」を選ぶとverdict=""で送信されるため、それは明示的なフィルタ解除として扱う。
  const verdict: ReportedPlayersVerdictFilter | undefined =
    verdictParam === undefined
      ? DEFAULT_VERDICT_FILTER
      : verdictParam !== "" && isVerdictFilter(verdictParam)
        ? verdictParam
        : undefined;
  const reviewedBy = moderatorIdParam || undefined;
  const sort = sortParam && isSort(sortParam) ? sortParam : DEFAULT_SORT;
  const direction = dirParam && isDirection(dirParam) ? dirParam : DEFAULT_DIRECTION;

  const [{ players, totalCount }, moderators] = await Promise.all([
    findReportedPlayers({
      page,
      pageSize: PAGE_SIZE,
      query,
      category,
      verdict,
      reviewedBy,
      sort,
      direction,
    }),
    prisma.moderator.findMany({
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = Boolean(
    query ||
      category ||
      verdict !== DEFAULT_VERDICT_FILTER ||
      reviewedBy ||
      sort !== DEFAULT_SORT ||
      direction !== DEFAULT_DIRECTION,
  );
  const filters: FilterParams = {
    q: query,
    category,
    verdictParam,
    moderatorId: reviewedBy,
    sort,
    direction,
  };

  return (
    <div>
      <h1>モデレーターダッシュボード</h1>

      <section className="section">
        <h2>レビュー対象を検索</h2>
        <p className="muted" style={{ marginBottom: "0.75rem" }}>
          サモナー名・カテゴリ・評価状態・評価モデレータで絞り込めます。デフォルトでは未評価の通報のみ表示しています。
        </p>

        <form style={{ marginBottom: "1.5rem" }}>
          <div className="form-row" style={{ alignItems: "flex-end" }}>
            <div className="form-field">
              <label htmlFor="q">サモナー名</label>
              <input type="text" id="q" name="q" defaultValue={query ?? ""} placeholder="例: Faker" />
            </div>
            <div className="form-field">
              <label htmlFor="category">カテゴリ</label>
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
              <label htmlFor="verdict">評価状態</label>
              <select id="verdict" name="verdict" defaultValue={verdict ?? ""}>
                <option value="">すべて</option>
                <option value="UNREVIEWED">⏳ 未評価のみ</option>
                {Object.entries(VERDICT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {VERDICT_ICONS[value as ModeratorVerdict]} {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="moderatorId">評価モデレータ</label>
              <select id="moderatorId" name="moderatorId" defaultValue={reviewedBy ?? ""}>
                <option value="">すべて</option>
                {moderators.map((m) => (
                  <option key={m.id} value={m.id}>
                    ⚔️ {m.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={direction} />
          <div className="form-actions">
            <button className="btn" type="submit">
              絞り込む
            </button>
            {hasFilters && (
              <Link className="btn btn-secondary" href="/moderator">
                条件をクリア
              </Link>
            )}
          </div>
        </form>

        <p className="muted" style={{ marginBottom: "0.75rem" }}>
          全{totalCount}件
        </p>

        {players.length === 0 ? (
          <div className="empty-state">
            <p>該当する対象はありません。</p>
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
                        <Link href={`/moderator/review/${player.puuid}`}>
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
      </section>
    </div>
  );
}
