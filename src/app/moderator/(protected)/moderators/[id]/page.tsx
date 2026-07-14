import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireModerator } from "@/lib/moderatorAuth";
import { findReviewsByModerator } from "@/lib/moderatorReviewList";
import { prisma } from "@/lib/prisma";
import { VERDICT_LABELS, VERDICT_BADGE_CLASS, VERDICT_ICONS } from "@/lib/moderatorVerdicts";
import { getLatestDdragonVersion } from "@/lib/riot";
import { getChampionIconUrl } from "@/lib/ddragon";

const PAGE_SIZE = 20;
const FALLBACK_DDRAGON_VERSION = "14.23.1";

// モデレーターごとの活動を毎回集計するため、ビルド時の静的プリレンダー対象から外す。
export const dynamic = "force-dynamic";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

export default async function ModeratorReviewListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
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

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);

  const [{ reviews, totalCount }, ddragonVersion] = await Promise.all([
    findReviewsByModerator({ moderatorId: id, page, pageSize: PAGE_SIZE }),
    getLatestDdragonVersion().catch(() => FALLBACK_DDRAGON_VERSION),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function pageHref(targetPage: number): string {
    const sp = new URLSearchParams();
    if (targetPage > 1) sp.set("page", String(targetPage));
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
        {totalCount}件)。
      </p>

      {reviews.length === 0 ? (
        <div className="empty-state">
          <p>まだレビューはありません。</p>
        </div>
      ) : (
        reviews.map((review) => {
          const name = review.report.player.nameHistory[0];
          return (
            <div className="card" key={review.id}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <Image
                  className="champion-icon"
                  src={getChampionIconUrl(ddragonVersion, review.report.championName)}
                  alt={review.report.championName}
                  width={28}
                  height={28}
                />
                <span className={VERDICT_BADGE_CLASS[review.verdict]}>
                  {VERDICT_ICONS[review.verdict]} {VERDICT_LABELS[review.verdict]}
                </span>
              </div>
              <p style={{ marginTop: "0.5rem" }}>
                対象:{" "}
                <Link href={`/players/${review.report.player.puuid}`}>
                  {name ? `${name.riotIdName} #${name.riotIdTagLine}` : review.report.player.puuid}
                </Link>{" "}
                ・ {review.report.championName} ・ {review.report.matchId}
              </p>
              <p style={{ marginTop: "0.5rem" }}>{review.rationale}</p>
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                🕒 {formatDateTime(review.createdAt)}
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
    </div>
  );
}
