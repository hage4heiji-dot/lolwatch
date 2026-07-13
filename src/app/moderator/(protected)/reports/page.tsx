import Link from "next/link";
import Image from "next/image";
import { requireModerator } from "@/lib/moderatorAuth";
import { findAllReportsForAdmin } from "@/lib/reportAdmin";
import type { HiddenFilter, ReviewedFilter } from "@/lib/reportAdmin";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/reportCategories";
import { queueLabel } from "@/lib/matchQueues";
import { getLatestDdragonVersion } from "@/lib/riot";
import { getChampionIconUrl } from "@/lib/ddragon";
import { ReportCategory } from "@/generated/prisma";

const PAGE_SIZE = 30;
const FALLBACK_DDRAGON_VERSION = "14.23.1";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
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

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    category?: string;
    hidden?: string;
    reviewed?: string;
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

  const [{ reports, totalCount }, ddragonVersion] = await Promise.all([
    findAllReportsForAdmin({ page, pageSize: PAGE_SIZE, filters: { category, hidden, reviewed, query } }),
    getLatestDdragonVersion().catch(() => FALLBACK_DDRAGON_VERSION),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function pageHref(targetPage: number): string {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (category) sp.set("category", category);
    if (hidden !== "all") sp.set("hidden", hidden);
    if (reviewed !== "all") sp.set("reviewed", reviewed);
    if (targetPage > 1) sp.set("page", String(targetPage));
    const qs = sp.toString();
    return qs ? `/moderator/reports?${qs}` : "/moderator/reports";
  }

  const hasFilters = Boolean(query || category || hidden !== "all" || reviewed !== "all");

  return (
    <div>
      <h1>全通報一覧(管理者)</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>
        非表示にされた通報も含め、新しい順に表示しています。
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
        <p className="muted">条件に一致する通報はありません。</p>
      ) : (
        reports.map((report) => {
          const name = report.player.nameHistory[0];
          const isReviewed = report.moderatorReviews.length > 0;
          return (
            <div
              className="card"
              key={report.id}
              style={report.hiddenAt ? { opacity: 0.6 } : undefined}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <Image
                    className="champion-icon"
                    src={getChampionIconUrl(ddragonVersion, report.championName)}
                    alt={report.championName}
                    width={28}
                    height={28}
                  />
                  <span className="badge">
                    {CATEGORY_ICONS[report.category]} {CATEGORY_LABELS[report.category]}
                  </span>
                  {report.hiddenAt && (
                    <span className="badge badge-verified-guilty">🙈 非表示中</span>
                  )}
                  {isReviewed ? (
                    <span className="badge badge-verified">✅ 評価済み</span>
                  ) : (
                    <span className="badge badge-unverified">⏳ 未評価</span>
                  )}
                </div>
                <Link
                  className="btn btn-secondary"
                  style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", flexShrink: 0 }}
                  href={`/moderator/review/${report.player.puuid}`}
                >
                  レビューを開く
                </Link>
              </div>
              <p style={{ marginTop: "0.5rem" }}>
                対象:{" "}
                <Link href={`/players/${report.player.puuid}`}>
                  {name ? `${name.riotIdName} #${name.riotIdTagLine}` : report.player.puuid}
                </Link>{" "}
                ・ {report.championName} ・ {queueLabel(report.queueId)} ・ {report.matchId}
              </p>
              {report.comment && (
                <p style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>{report.comment}</p>
              )}
              {report.videoUrl && (
                <p style={{ marginTop: "0.5rem" }}>
                  <a href={report.videoUrl} target="_blank" rel="noopener noreferrer">
                    🎬 添付動画を見る
                  </a>
                </p>
              )}
              {report.imageUrl && (
                <p style={{ marginTop: "0.5rem" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 任意の外部ホストの画像なのでnext/imageのremotePatternsに載せられない */}
                  <img
                    src={report.imageUrl}
                    alt="通報者が添付した画像"
                    style={{ maxWidth: "100%", maxHeight: "240px", borderRadius: "6px" }}
                  />
                </p>
              )}
              {report.hiddenReason && (
                <p className="muted" style={{ marginTop: "0.5rem" }}>
                  非表示理由: {report.hiddenReason}
                </p>
              )}
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                🕒 {formatDateTime(report.createdAt)}
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
