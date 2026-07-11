import Link from "next/link";
import { findPlayersNeedingReview } from "@/lib/playerProfile";
import { ModeratorSearchForm } from "./search-form";

export default async function ModeratorDashboardPage() {
  const players = await findPlayersNeedingReview();

  return (
    <div>
      <h1>モデレーターダッシュボード</h1>

      <section className="section">
        <h2>ゲームIDを指定してレビュー</h2>
        <ModeratorSearchForm />
      </section>

      <section className="section">
        <h2>未レビューかつ通報の多い順</h2>
        {players.length === 0 ? (
          <p className="muted">レビュー待ちの対象はありません。</p>
        ) : (
          players.map((player) => {
            const name = player.nameHistory[0];
            return (
              <div className="card" key={player.id}>
                <Link href={`/moderator/review/${player.puuid}`}>
                  {name ? `${name.riotIdName} #${name.riotIdTagLine}` : player.puuid}
                </Link>
                <p className="muted" style={{ marginTop: "0.35rem" }}>
                  通報件数: {player._count.reports}
                </p>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
