import { MatchLookup } from "./match-lookup";

export default function Home() {
  return (
    <div>
      <h1>試合IDでゲームIDを検索・通報</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
        LoLクライアントの試合履歴等で確認できる試合ID(Match ID)を入力してください。その試合の参加者一覧からプロフィールの閲覧、または通報したいアカウントの選択ができます。
      </p>
      <MatchLookup />
    </div>
  );
}
