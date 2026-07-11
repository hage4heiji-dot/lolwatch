import Link from "next/link";
import { findReportedPlayers } from "@/lib/playerProfile";
import { VERDICT_LABELS, VERDICT_BADGE_CLASS } from "@/lib/moderatorVerdicts";

const PAGE_SIZE = 20;

export default async function ReportedPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const { players, totalCount } = await findReportedPlayers({ page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div>
      <h1>通報されているユーザー一覧</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
        通報件数の多い順に表示しています(全{totalCount}件)。「モデレーター評価」バッジは、運営が実際にリプレイ等を確認した上での判定です。バッジのない対象は一般ユーザーからの未検証の通報のみです。
      </p>

      {players.length === 0 ? (
        <p className="muted">まだ通報はありません。</p>
      ) : (
        players.map((player) => {
          const name = player.nameHistory[0];
          const latestReview = player.moderatorReviews[0];
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
                  {VERDICT_LABELS[latestReview.verdict]}
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
            <Link className="btn btn-secondary" href={`/players?page=${page - 1}`}>
              前へ
            </Link>
          ) : (
            <span />
          )}
          <span className="muted">
            {page} / {totalPages} ページ
          </span>
          {page < totalPages ? (
            <Link className="btn btn-secondary" href={`/players?page=${page + 1}`}>
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
