import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModerator } from "@/lib/moderatorAuth";
import { findReviewsByModerator, ModeratorReviewListSort } from "@/lib/moderatorReviewList";
import { prisma } from "@/lib/prisma";
import { VERDICT_LABELS, VERDICT_BADGE_CLASS, VERDICT_ICONS } from "@/lib/moderatorVerdicts";

const PAGE_SIZE = 20;

// モデレーターごとの活動を毎回集計するため、ビルド時の静的プリレンダー対象から外す。
export const dynamic = "force-dynamic";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function toSort(value: string | undefined): ModeratorReviewListSort {
  return value === "oldest" ? "oldest" : "newest";
}

export default async function ModeratorReviewListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const viewer = await requireModerator();
  const { id } = await params;

  // 自分自身のレビュー一覧は誰でも見られる。他人のものは管理者のみ閲覧可能
  // (管理者・モデレーターどちらの権限で見ているかに関わらず、この1本のルートで完結させる)。
  if (viewer.id !== id && !viewer.isAdmin) {
    return (
      <div>
        <h1>レビュー一覧</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          他のモデレーターのレビュー一覧は管理者権限を持つモデレーターのみ閲覧できます。
        </p>
      </div>
    );
  }

  const target = await prisma.moderator.findUnique({
    where: { id },
    select: { id: true, displayName: true, isAdmin: true },
  });

  if (!target) {
    notFound();
  }

  const { page: pageParam, sort: sortParam } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const sort = toSort(sortParam);

  const { reviews, totalCount } = await findReviewsByModerator({
    moderatorId: id,
    page,
    pageSize: PAGE_SIZE,
    sort,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function buildHref({ page: targetPage, sort: targetSort }: { page?: number; sort?: ModeratorReviewListSort }): string {
    const sp = new URLSearchParams();
    const nextSort = targetSort ?? sort;
    if (nextSort !== "newest") sp.set("sort", nextSort);
    if (targetPage && targetPage > 1) sp.set("page", String(targetPage));
    const qs = sp.toString();
    return qs ? `/moderator/moderators/${id}?${qs}` : `/moderator/moderators/${id}`;
  }

  return (
    <div>
      <h1>
        ⚔️ {target.displayName} のレビュー一覧
        {target.isAdmin && <span className="muted"> (管理者)</span>}
      </h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>
        {viewer.id === id ? "自分が" : `${target.displayName}が`}これまでにレビューした通報の一覧です(総件数:{" "}
        {totalCount}件)。見出しをクリックすると並び替えられます。
      </p>

      {reviews.length === 0 ? (
        <div className="empty-state">
          <p>まだレビューはありません。</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>対象</th>
                <th>判定</th>
                <th>理由</th>
                <th>
                  <Link
                    href={buildHref({ sort: sort === "newest" ? "oldest" : "newest" })}
                    className="sortable-header active"
                  >
                    レビュー日時
                    <span className="sort-arrow">{sort === "newest" ? " ▼" : " ▲"}</span>
                  </Link>
                </th>
                <th>アクション</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review, i) => {
                const name = review.report.player.nameHistory[0];
                return (
                  <tr key={review.id}>
                    <td>
                      <span className="rank-badge">{(page - 1) * PAGE_SIZE + i + 1}</span>
                    </td>
                    <td>
                      <Link href={`/players/${review.report.player.puuid}`}>
                        {name ? `${name.riotIdName} #${name.riotIdTagLine}` : review.report.player.puuid}
                      </Link>
                      <p className="muted" style={{ marginTop: "0.2rem" }}>
                        {review.report.championName} ・ {review.report.matchId}
                      </p>
                    </td>
                    <td>
                      <span className={VERDICT_BADGE_CLASS[review.verdict]}>
                        {VERDICT_ICONS[review.verdict]} {VERDICT_LABELS[review.verdict]}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "normal", maxWidth: "320px" }}>{review.rationale}</td>
                    <td className="muted">{formatDateTime(review.createdAt)}</td>
                    <td>
                      {viewer.id === review.moderatorId && (
                        <Link
                          className="btn btn-secondary"
                          style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                          href={`/moderator/review/${review.report.player.puuid}`}
                        >
                          編集
                        </Link>
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
            <Link className="btn btn-secondary" href={buildHref({ page: page - 1 })}>
              前へ
            </Link>
          ) : (
            <span />
          )}
          <span className="muted">
            {page} / {totalPages} ページ
          </span>
          {page < totalPages ? (
            <Link className="btn btn-secondary" href={buildHref({ page: page + 1 })}>
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
