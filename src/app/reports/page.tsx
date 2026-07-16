import Link from "next/link";
import type { Metadata } from "next";
import { findPublicReports, PublicReportSort } from "@/lib/reportList";
import { VERDICT_LABELS, VERDICT_BADGE_CLASS, VERDICT_ICONS } from "@/lib/moderatorVerdicts";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/reportCategories";
import { queueLabel } from "@/lib/matchQueues";
import type { ReportedPlayersVerdictFilter } from "@/lib/playerProfile";
import { ModeratorVerdict, ReportCategory } from "@/generated/prisma";

const PAGE_SIZE = 30;
const VERDICT_FILTER_VALUES: ReportedPlayersVerdictFilter[] = [
  "UNREVIEWED",
  ...(Object.keys(VERDICT_LABELS) as ModeratorVerdict[]),
];

// DB通報件数を毎回集計するため、ビルド時の静的プリレンダー対象から外す。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "通報一覧",
  description: "LoLで寄せられた個々の通報を新着順に確認できます。カテゴリやモデレーター評価で絞り込み可能です。",
};

function isReportCategory(value: string): value is ReportCategory {
  return value in CATEGORY_LABELS;
}

function isVerdictFilter(value: string): value is ReportedPlayersVerdictFilter {
  return (VERDICT_FILTER_VALUES as string[]).includes(value);
}

function isSort(value: string): value is PublicReportSort {
  return value === "newest" || value === "oldest";
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
  category?: string;
  verdict?: string;
  sort: PublicReportSort;
}

function buildHref(params: FilterParams & { page?: number }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category) sp.set("category", params.category);
  if (params.verdict) sp.set("verdict", params.verdict);
  if (params.sort !== "newest") sp.set("sort", params.sort);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/reports?${qs}` : "/reports";
}

function SortableDateHeader({ label, filters }: { label: string; filters: FilterParams }) {
  const nextSort: PublicReportSort = filters.sort === "newest" ? "oldest" : "newest";
  const href = buildHref({ ...filters, sort: nextSort });

  return (
    <th>
      <Link href={href} className="sortable-header active">
        {label}
        <span className="sort-arrow">{filters.sort === "newest" ? " ▼" : " ▲"}</span>
      </Link>
    </th>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    category?: string;
    verdict?: string;
    sort?: string;
  }>;
}) {
  const {
    page: pageParam,
    q,
    category: categoryParam,
    verdict: verdictParam,
    sort: sortParam,
  } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const query = q?.trim() || undefined;
  const category = categoryParam && isReportCategory(categoryParam) ? categoryParam : undefined;
  const verdict = verdictParam && isVerdictFilter(verdictParam) ? verdictParam : undefined;
  const sort = sortParam && isSort(sortParam) ? sortParam : "newest";

  const { reports, totalCount } = await findPublicReports({
    page,
    pageSize: PAGE_SIZE,
    category,
    verdict,
    query,
    sort,
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = Boolean(query || category || verdict);
  const filters: FilterParams = { q: query, category, verdict, sort };

  return (
    <div>
      <h1>通報一覧</h1>
      <p className="muted" style={{ marginTop: "0.5rem" }}>全{totalCount}件</p>
      <p className="muted" style={{ marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        寄せられた個々の通報を並べています(ユーザーごとの集計は
        <Link href="/players">ユーザー一覧</Link>
        )。「モデレーター評価」バッジは運営が実際にリプレイ等を確認した上での判定です。見出しをクリックすると並び替えられます。
      </p>

      <form style={{ marginBottom: "1.5rem" }}>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="q">Riot ID・試合IDで検索</label>
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
        </div>
        <input type="hidden" name="sort" value={sort} />
        <div className="form-actions">
          <button className="btn" type="submit">
            検索
          </button>
          {hasFilters && (
            <Link className="btn btn-secondary" href="/reports">
              条件をクリア
            </Link>
          )}
        </div>
      </form>

      {reports.length === 0 ? (
        <div className="empty-state">
          <p>{hasFilters ? "条件に一致する通報が見つかりませんでした。" : "まだ通報はありません。"}</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>対象</th>
                <th>カテゴリ</th>
                <th>モデレーター評価</th>
                <SortableDateHeader label="通報日時" filters={filters} />
              </tr>
            </thead>
            <tbody>
              {reports.map((report, i) => {
                const name = report.player.nameHistory[0];
                const latestReview = report.moderatorReviews[0];
                return (
                  <tr key={report.id}>
                    <td>
                      <span className="rank-badge">{(page - 1) * PAGE_SIZE + i + 1}</span>
                    </td>
                    <td>
                      <Link href={`/players/${report.player.puuid}?report=${report.id}#report-${report.id}`}>
                        {name ? `${name.riotIdName} #${name.riotIdTagLine}` : report.player.puuid}
                      </Link>
                      <p className="muted" style={{ marginTop: "0.2rem" }}>
                        {report.championName} ・ {queueLabel(report.queueId)}
                      </p>
                    </td>
                    <td>
                      <span className="badge">
                        {CATEGORY_ICONS[report.category]} {CATEGORY_LABELS[report.category]}
                      </span>
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
                    <td className="muted">{formatDateTime(report.createdAt)}</td>
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
