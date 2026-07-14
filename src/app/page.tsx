import Link from "next/link";
import { getMostWatchedPlayers } from "@/lib/stats";
import { periodFilterSince } from "@/lib/periodFilter";

// DB通報件数を毎回集計するため、ビルド時の静的プリレンダー対象から外す。
export const dynamic = "force-dynamic";

export default async function Home() {
  const watchedPlayers = await getMostWatchedPlayers(5, periodFilterSince("month"));

  return (
    <div>
      <h1>⚠️ lolwatchとは</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>
        LoLの試合中に暴言・チート・意図的な敗北行為などをした相手を、試合IDから誰でも通報できる非公式の監視サイトです。通報は検証なしで即座に公開され、モデレーターが実際にリプレイや証跡を確認した上で「違反」を判定します。相手のRiot
        IDが分かれば、あなたを傷つけた相手が何度通報されているか誰でも確認できます。
      </p>

      <Link href="/report" className="report-cta">
        <span className="report-cta-title">🚨 通報はここから</span>
        <span className="report-cta-sub">
          受けた被害を今すぐ記録に残す。試合IDを入力するだけ。
        </span>
      </Link>

      <section className="section">
        <h2>🔻 直近1か月の要注意人物</h2>
        <p className="muted" style={{ marginBottom: "0.75rem" }}>
          直近1か月で通報が多く、かつ他の利用者から「この通報は妥当」と支持された数が多い順です。
        </p>
        {watchedPlayers.length === 0 ? (
          <p className="muted">直近1か月はまだ要注意人物がいません。</p>
        ) : (
          <div className="watchlist">
            {watchedPlayers.map((player, i) => (
              <Link href={`/players/${player.puuid}`} key={player.puuid} className="watchlist-row">
                <span className="watchlist-rank">{i + 1}</span>
                <span className="watchlist-name">{player.displayName}</span>
                <span className="watchlist-tally">
                  <span className="watchlist-tally-item">🚩 通報 {player.reportCount}件</span>
                  <span className="watchlist-tally-item">👍 妥当 {player.validatedCount}件</span>
                  <span className="watchlist-tally-item">👎 不当 {player.invalidCount}件</span>
                  <span className="watchlist-tally-item">🧑‍⚖️ モデレータ評価 {player.reviewedCount}件</span>
                </span>
              </Link>
            ))}
          </div>
        )}
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          <Link href="/players">通報一覧をすべて見る →</Link>
        </p>
      </section>
    </div>
  );
}
