import type { Metadata } from "next";
import Link from "next/link";
import { RiotDataReader } from "./riot-data-reader";

// 「lol 通報された回数」等で検索して来る人向けの解説ページ。
// Riot公式で確認できる範囲(データリクエスト)と、lolwatch上の通報件数の違いを整理し、
// サイト内検索へ誘導する。Riot側の仕様は変わりうるので、断定できない点は断定しない。
export const metadata: Metadata = {
  title: "LoLで通報された回数を確認する方法",
  description:
    "League of Legendsで自分が通報された回数を確認する方法を解説。Riot公式のデータリクエストの手順と、lolwatchで通報件数を検索する方法を紹介します。",
  alternates: { canonical: "/how-to-check-reports" },
};

const RIOT_DATA_REQUEST_URL = "https://support.riotgames.com/ja-jp/riot/data-request";

export default function HowToCheckReportsPage() {
  return (
    <div>
      <h1>LoLで通報された回数を確認する方法</h1>
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        League of Legendsのゲーム内には、自分が何回通報されたかを表示する画面はありません。
        確認したい場合は、次の2つの方法があります。
      </p>

      <section className="section">
        <h2>1. Riot公式のデータリクエストで確認する</h2>
        <div className="card">
          <p>
            Riot
            Gamesには、自分のアカウントに関するデータをまとめて取り寄せる「データリクエスト」の仕組みがあります。
            取り寄せたデータには、ゲーム内で
            <strong>通報された回数・通報した回数(理由別)</strong>と<strong>ペナルティ履歴</strong>
            が含まれています。
          </p>
          <ol className="data-request-steps">
            <li className="data-request-step">
              <span className="data-request-step-num">1</span>
              <div className="data-request-step-body">
                <strong>Riotのデータリクエストのページを開く</strong>
                <p className="muted">Riotアカウントでログインします。</p>
                <a
                  href={RIOT_DATA_REQUEST_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn data-request-step-btn"
                >
                  Riotのページを開く ↗
                </a>
              </div>
            </li>
            <li className="data-request-step">
              <span className="data-request-step-num">2</span>
              <div className="data-request-step-body">
                <strong>データをリクエストする</strong>
                <p className="muted">画面の案内に従ってリクエストを送信します。</p>
              </div>
            </li>
            <li className="data-request-step">
              <span className="data-request-step-num">3</span>
              <div className="data-request-step-body">
                <strong>ダウンロード用のリンクが届く</strong>
                <p className="muted">
                  届くまでの期間はアカウントの状態や地域によって異なります。リンクには有効期限がある場合があるので、届いたら早めに保存してください。
                </p>
              </div>
            </li>
            <li className="data-request-step">
              <span className="data-request-step-num">4</span>
              <div className="data-request-step-body">
                <strong>lolwatchで読み込んで集計する</strong>
                <p className="muted">
                  届いたzipファイルを展開せずにそのまま選ぶと、通報された回数・通報した回数(理由別)とペナルティ履歴を表示します。
                </p>
                <RiotDataReader />
              </div>
            </li>
          </ol>
          <p style={{ marginTop: "0.75rem" }}>
            <strong>取り寄せられる主なデータ(Riot公式ページより)</strong>
          </p>
          <ul style={{ paddingLeft: "1.2rem" }}>
            <li>アカウントとプロフィール(Riot ID、メールアドレス、地域、アカウント履歴)</li>
            <li>購入と請求</li>
            <li>ゲームプレイと試合データ</li>
            <li>サポートとコミュニケーション(チケット、チャット、メッセージのログ)</li>
          </ul>
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            ※
            ファイルにはメールアドレスやチャットログなどの個人情報が含まれます。他人に渡したり、SNS等にそのまま公開したりしないでください。
          </p>
        </div>
      </section>

      <section className="section">
        <h2>2. lolwatchで通報件数を検索する(すぐ確認できる)</h2>
        <div className="card">
          <p>
            Riot
            ID(名前#タグ)で検索すると、lolwatchに投稿された通報の件数・内容・モデレーターの判定結果を確認できます。
          </p>
          <form action="/players" method="get" style={{ marginTop: "1rem" }}>
            <input type="hidden" name="period" value="all" />
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="q">Riot ID(名前#タグ)</label>
                <input type="text" id="q" name="q" placeholder="例: Faker#KR1" required />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn" type="submit">
                通報件数を検索
              </button>
            </div>
          </form>
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            ※
            ここで表示されるのは、lolwatchのユーザーが投稿した通報の件数です。ゲーム内でRiotに送られた通報の件数とは別物です。
            検索して見つからない場合、lolwatchではまだ通報されていません。
          </p>
        </div>
      </section>

      <section className="section">
        <h2>よくある質問</h2>
        <div className="card">
          <p>
            <strong>Q. 通報された回数が多いとBANされますか?</strong>
          </p>
          <p>
            Riotは、通報の件数だけで処分を決めるのではなく、チャット内容や試合中の行動などを確認して判断するとしています。通報が多いこと自体がすぐに処分につながるわけではありません。
          </p>
          <p style={{ marginTop: "1rem" }}>
            <strong>Q. 誰に通報されたかは分かりますか?</strong>
          </p>
          <p>Riotは通報した人の情報を通報された側に公開していません。</p>
          <p style={{ marginTop: "1rem" }}>
            <strong>Q. lolwatchの通報件数とRiotの通報件数は同じですか?</strong>
          </p>
          <p>
            いいえ。lolwatchの通報件数は、lolwatchのユーザーが試合情報とあわせて投稿したものです。投稿された通報はモデレーターがリプレイを確認して判定します(判断基準は
            <Link href="/guidelines">ガイドライン</Link>
            を参照)。
          </p>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <p>
            自分がどんなプレイを「通報すべき」と感じるタイプか気になる方は、
            <Link href="/calibration">判定基準診断</Link>
            も試してみてください。迷惑なプレイヤーに遭遇した場合は
            <Link href="/report">こちらから通報</Link>
            できます。
          </p>
        </div>
      </section>
    </div>
  );
}
