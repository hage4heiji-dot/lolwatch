import type { Metadata } from "next";
import { MatchLookup } from "../match-lookup";

export const metadata: Metadata = {
  title: "通報する",
  description: "試合ID(Match ID)またはサモナー名から試合を検索し、暴言・チート等の迷惑行為を通報できます。",
};

export default function ReportPage() {
  return (
    <div>
      <h1>ゲームIDを検索・通報</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
        LoLクライアントの試合履歴等で確認できる試合ID(Match ID)を入力するか、サモナー名(Riot ID)から直近20戦を一覧表示して試合を選べます。その試合の参加者一覧からプロフィールの閲覧、または通報したいアカウントの選択ができます。
      </p>
      <MatchLookup />
    </div>
  );
}
