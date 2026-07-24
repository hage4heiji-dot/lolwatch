import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CalibrationQuiz } from "./calibration-quiz";
import { CALIBRATION_SCENARIOS } from "@/lib/calibrationScenarios";
import { getCalibrationOverview, getLatestCalibrationAttemptIdForDevice } from "@/lib/calibrationStats";
import { DEVICE_ID_COOKIE } from "@/lib/deviceId";

// 受験のたびに全体平均が変わるため、ビルド時の静的プリレンダー対象から外す。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "判定基準診断",
  description:
    "LoLでよくある判断の分かれるグレーな行為について、あなたなら「違反」〜「問題なし」のどこに判定するかを5分程度で診断できます。",
};

export default async function CalibrationPage() {
  const cookieStore = await cookies();
  const deviceId = cookieStore.get(DEVICE_ID_COOKIE)?.value ?? null;

  const [overview, latestAttemptId] = await Promise.all([
    getCalibrationOverview(),
    deviceId ? getLatestCalibrationAttemptIdForDevice(deviceId) : Promise.resolve(null),
  ]);

  return (
    <div>
      <h1>判定基準診断</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>
        LoLでよくある「トロールっぽいけど断定はできない」グレーな場面を{CALIBRATION_SCENARIOS.length}
        問出題します。あなたなら各シナリオを5段階のどこに判定するか答えてみてください。所要時間は5分ほどで、正解・不正解はありません。回答後にみんなの平均と比較できます。
      </p>

      {overview.attemptCount > 0 && (
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          これまでの受験者数: {overview.attemptCount}人 / 全体平均スコア:{" "}
          {overview.overallAverage !== null ? overview.overallAverage.toFixed(1) : "-"}(1=違反 〜
          5=問題なし)
        </p>
      )}

      {latestAttemptId && (
        <p style={{ marginBottom: "1.5rem" }}>
          <Link href={`/calibration/result/${latestAttemptId}`} className="btn btn-secondary">
            前回の結果を見る
          </Link>
        </p>
      )}

      <CalibrationQuiz />
    </div>
  );
}
