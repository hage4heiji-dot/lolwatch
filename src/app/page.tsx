import Link from "next/link";
import Image from "next/image";
import { getMostWatchedPlayers } from "@/lib/stats";
import { periodFilterSince } from "@/lib/periodFilter";
import { getSplashArtUrl, pickRandomMisunderstoodTrollChampion } from "@/lib/ddragon";
import calibrationBanner from "./calibration/banner.png";

// DB通報件数を毎回集計するため、ビルド時の静的プリレンダー対象から外す。
export const dynamic = "force-dynamic";

export default async function Home() {
  const watchedPlayers = await getMostWatchedPlayers(5, periodFilterSince("month"));
  const heroChampion = pickRandomMisunderstoodTrollChampion();

  return (
    <div>
      <section className="hero" style={{ backgroundImage: `url(${getSplashArtUrl(heroChampion)})` }}>
        <p className="hero-eyebrow">LOLWATCH ｜ LoL 非公式監視サイト</p>
        <h1 className="hero-title">
          トロールを、<span className="hero-title-accent">可視化する。</span>
        </h1>
        <div className="hero-divider">
          <span className="hero-divider-line"></span>
          <span className="hero-divider-mark">◆</span>
          <span className="hero-divider-line"></span>
        </div>
        <p className="hero-desc">
          LoLの試合中に暴言・チート・意図的な敗北行為などをした相手を、試合IDから誰でも通報できる非公式の監視サイトです。通報は検証なしで即座に公開され、モデレーターが実際にリプレイや証跡を確認した上で「違反」を判定します。相手のRiot
          IDが分かれば、あなたを傷つけた相手が何度通報されているか誰でも確認できます。
        </p>
      </section>

      <Link href="/report" className="report-cta">
        <span className="report-cta-title">🚨 通報はここから</span>
        <span className="report-cta-sub">
          受けた被害を今すぐ記録に残す。試合IDを入力するだけ。
        </span>
      </Link>

      <section className="section">
        <h2>🔻 直近1か月の注目ユーザー</h2>
        <p className="muted" style={{ marginBottom: "0.75rem" }}>
          直近1か月で通報が多く、かつ他の利用者から「この通報は妥当」と支持された数が多い順です。「実質通報」は、通報件数からモデレーターが「証拠不十分」「違反なしと判断」と判定した通報を除いた件数です。
        </p>
        {watchedPlayers.length === 0 ? (
          <p className="muted">直近1か月はまだ注目ユーザーがいません。</p>
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
                  <span
                    className={`watchlist-tally-item${player.netReportCount === 0 ? " watchlist-tally-item-cleared" : ""}`}
                    title="通報件数から「証拠不十分」「違反なしと判断」の通報を除いた件数です。"
                  >
                    ⚖️ 実質通報 {player.netReportCount}件
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          <Link href="/players">ユーザー一覧をすべて見る →</Link>
        </p>
      </section>

      <Link href="/calibration">
        <Image
          src={calibrationBanner}
          alt="あなたならどう判定する? 判定基準診断 | LoLのグレーゾーン9問。あなたの判定をみんなと比較!"
          className="calibration-banner"
          sizes="(max-width: 640px) 100vw, 720px"
        />
      </Link>
    </div>
  );
}
