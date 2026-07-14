import Link from "next/link";
import { findReportedPlayers, ReportedPlayersVerdictFilter } from "@/lib/playerProfile";
import { VERDICT_LABELS, VERDICT_ICONS, VERDICT_BADGE_CLASS } from "@/lib/moderatorVerdicts";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/reportCategories";
import { ModeratorVerdict, ReportCategory } from "@/generated/prisma";
import { ModeratorSearchForm } from "./search-form";

const PAGE_SIZE = 20;
const DEFAULT_VERDICT_FILTER: ReportedPlayersVerdictFilter = "UNREVIEWED";
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

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

export default async function ModeratorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; category?: string; verdict?: string }>;
}) {
  const {
    page: pageParam,
    q,
    category: categoryParam,
    verdict: verdictParam,
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

  const { players, totalCount } = await findReportedPlayers({
    page,
    pageSize: PAGE_SIZE,
    query,
    category,
    verdict,
    sort: "reportCount",
    direction: "desc",
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = Boolean(query || category || verdict !== DEFAULT_VERDICT_FILTER);

  function pageHref(targetPage: number): string {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (category) sp.set("category", category);
    if (verdictParam !== undefined) sp.set("verdict", verdictParam);
    if (targetPage > 1) sp.set("page", String(targetPage));
    const qs = sp.toString();
    return qs ? `/moderator?${qs}` : "/moderator";
  }

  return (
    <div>
      <h1>モデレーターダッシュボード</h1>

      <section className="section">
        <h2>ゲームIDを指定してレビュー</h2>
        <ModeratorSearchForm />
      </section>

      <section className="section">
        <h2>レビュー対象を検索</h2>
        <p className="muted" style={{ marginBottom: "0.75rem" }}>
          サモナー名・カテゴリ・評価状態で絞り込めます。デフォルトでは未評価の通報のみ表示しています。
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
          </div>
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
          全{totalCount}件(通報件数の多い順)
        </p>

        {players.length === 0 ? (
          <p className="muted">該当する対象はありません。</p>
        ) : (
          players.map((player) => {
            const name = player.nameHistory[0];
            return (
              <div className="card" key={player.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <Link href={`/moderator/review/${player.puuid}`}>
                    {name ? `${name.riotIdName} #${name.riotIdTagLine}` : player.puuid}
                  </Link>
                  {player.latestReview && (
                    <span className={VERDICT_BADGE_CLASS[player.latestReview.verdict]}>
                      {VERDICT_ICONS[player.latestReview.verdict]} {VERDICT_LABELS[player.latestReview.verdict]}
                    </span>
                  )}
                </div>
                <p className="muted" style={{ marginTop: "0.35rem" }}>
                  通報件数: {player.reportCount}
                  {player.latestReportAt && ` ・ 最新: ${formatDateTime(player.latestReportAt)}`}
                </p>
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
              <Link className="btn btn-secondary" href={pageHref(page - 1)}>
                前へ
              </Link>
            ) : (
              <span />
            )}
            <span className="muted">
              {page} / {totalPages} ページ
            </span>
            {page < totalPages ? (
              <Link className="btn btn-secondary" href={pageHref(page + 1)}>
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
