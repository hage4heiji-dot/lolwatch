import type { Metadata } from "next";
import { TrollHuntGame } from "./troll-hunt-game";

export const metadata: Metadata = {
  title: "トロール討伐ゲーム",
  description:
    "最大4人までリアルタイム協力プレイできるビート同期の通報アクションゲーム。動き回るトロールをビートに合わせて狙って通報しよう。",
};

export default function GamePage() {
  return (
    <div>
      <h1>トロール討伐ゲーム</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>
        画面を動き回る😈トロールをビートに合わせて狙って通報しよう。タイミングが合うほどPERFECT/GOOD判定でスコアアップ。😊エンジョイ勢を誤通報するとコンボが切れて減点。ひとりでも、最大4人まで部屋を作ってリアルタイム協力プレイもできます。
      </p>
      <TrollHuntGame />
    </div>
  );
}
