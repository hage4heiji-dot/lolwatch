import Link from "next/link";
import { requireModerator } from "@/lib/moderatorAuth";
import { findAllReportsForAdmin } from "@/lib/reportAdmin";
import type { HiddenFilter, ReviewedFilter, ReportAdminSort } from "@/lib/reportAdmin";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/reportCategories";
import { queueLabel } from "@/lib/matchQueues";
import { ReportCategory } from "@/generated/prisma";

const PAGE_SIZE = 30;

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function toHiddenFilter(value: string | undefined): HiddenFilter {
  return value === "hidden" || value === "visible" ? value : "all";
}

function toReviewedFilter(value: string | undefined): ReviewedFilter {
  return value === "reviewed" || value === "unreviewed" ? value : "all";
}

function toCategory(value: string | undefined): ReportCategory | undefined {
  return value && value in CATEGORY_LABELS ? (value as ReportCategory) : undefined;
}

function toSort(value: string | undefined): ReportAdminSort {
  return value === "oldest" ? "oldest" : "newest";
}

interface FilterParams {
  query?: string;
  category?: ReportCategory;
  hidden: HiddenFilter;
  reviewed: ReviewedFilter;
  sort: ReportAdminSort;
}

function buildHref(params: FilterParams & { page?: number }): string {
  const sp = new URLSearchParams();
  if (params.query) sp.set("q", params.query);
  if (params.category) sp.set("category", params.category);
  if (params.hidden !== "all") sp.set("hidden", params.hidden);
  if (params.reviewed !== "all") sp.set("reviewed", params.reviewed);
  if (params.sort !== "newest") sp.set("sort", params.sort);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/moderator/reports?${qs}` : "/moderator/reports";
}

function SortableDateHeader({ label, filters }: { label: string; filters: FilterParams }) {
  const nextSort: ReportAdminSort = filters.sort === "newest" ? "oldest" : "newest";
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

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    category?: string;
    hidden?: string;
    reviewed?: string;
    sort?: string;
  }>;
}) {
  const moderator = await requireModerator();

  if (!moderator.isAdmin) {
    return (
      <div>
        <h1>全通報一覧</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          このページは管理者権限を持つモデレーターのみ利用できます。
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const query = params.q?.trim() || undefined;
  const category = toCategory(params.category);
  const hidden = toHiddenFilter(params.hidden);
  const reviewed = toReviewedFilter(params.reviewed);
  const sort = toSort(params.sort);

  const { reports, totalCount } = await findAllReportsForAdmin({
    page,
    pageSize: PAGE_SIZE,
    filters: { category, hidden, reviewed, query },
    sort,
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = Boolean(query || category || hidden !== "all" || reviewed !== "all");
  const filters: FilterParams = { query, category, hidden, reviewed, sort };

  return (
    <div>
      <h1>全通報一覧(管理者)</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>
        非表示にされた通報も含めて表示しています。見出しをクリックすると並び替えられます。
      </p>

      <form
        method="get"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.6rem",
          alignItems: "flex-end",
          marginBottom: "1.5rem",
          padding: "1rem",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          background: "var(--card-bg)",
        }}
      >
        <div className="form-field" style={{ marginBottom: 0, flex: "1 1 200px" }}>
          <label htmlFor="q">🔍 ゲームID・試合ID・チャンピオン名で検索</label>
          <input id="q" name="q" defaultValue={query ?? ""} placeholder="例: SummonerName、JP1_123..." />
        </div>
        <div className="form-field" style={{ marginBottom: 0 }}>
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
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label htmlFor="hidden">表示状態</label>
          <select id="hidden" name="hidden" defaultValue={hidden}>
            <option value="all">すべて</option>
            <option value="visible">👁️ 表示中のみ</option>
            <option value="hidden">🙈 非表示中のみ</option>
          </select>
        </div>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label htmlFor="reviewed">評価状態</label>
          <select id="reviewed" name="reviewed" defaultValue={reviewed}>
            <option value="all">すべて</option>
            <option value="reviewed">✅ 評価済みのみ</option>
            <option value="unreviewed">⏳ 未評価のみ</option>
          </select>
        </div>
        <input type="hidden" name="sort" value={sort} />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn" type="submit">
            絞り込む
          </button>
          {hasFilters && (
            <Link className="btn btn-secondary" href="/moderator/reports">
              リセット
            </Link>
          )}
        </div>
      </form>

      <p className="muted" style={{ marginBottom: "0.75rem" }}>
        {hasFilters ? `絞り込み結果: ${totalCount}件` : `全${totalCount}件`}
      </p>

      {reports.length === 0 ? (
        <div className="empty-state">
          <p>条件に一致する通報はありません。</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>対象</th>
                <th>カテゴリ</th>
                <th>状態</th>
                <SortableDateHeader label="通報日時" filters={filters} />
              </tr>
            </thead>
            <tbody>
              {reports.map((report, i) => {
                const name = report.player.nameHistory[0];
                const isReviewed = report.moderatorReviews.length > 0;
                return (
                  <tr key={report.id} style={report.hiddenAt ? { opacity: 0.6 } : undefined}>
                    <td>
                      <span className="rank-badge">{(page - 1) * PAGE_SIZE + i + 1}</span>
                    </td>
                    <td>
                      <Link href={`/moderator/review/${report.player.puuid}`}>
                        {name ? `${name.riotIdName} #${name.riotIdTagLine}` : report.player.puuid}
                      </Link>
                      <p className="muted" style={{ marginTop: "0.2rem" }}>
                        {report.championName} ・ {queueLabel(report.queueId)} ・ {report.matchId}
                      </p>
                    </td>
                    <td>
                      <span className="badge">
                        {CATEGORY_ICONS[report.category]} {CATEGORY_LABELS[report.category]}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", alignItems: "flex-start" }}>
                        {report.hiddenAt ? (
                          <span
                            className="badge badge-verified-guilty"
                            title={report.hiddenReason ?? undefined}
                          >
                            🙈 非表示中
                          </span>
                        ) : (
                          <span className="badge">👁️ 表示中</span>
                        )}
                        {isReviewed ? (
                          <span className="badge badge-verified">✅ 評価済み</span>
                        ) : (
                          <span className="badge badge-unverified">⏳ 未評価</span>
                        )}
                      </div>
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
