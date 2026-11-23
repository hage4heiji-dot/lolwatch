// 「みんなとの比較」欄。4象限グラフとタイプの説明を出す。
// 読み込み直後の画面と共有ページの両方で使うため状態は持たない。
import type { RiotReportComparison } from "@/lib/riotReportStats";
import { getTypeName, LEANS, QUADRANTS } from "@/lib/reportCountTitle";
import { MIN_PARTICIPANTS_FOR_RANKING_LABEL } from "./constants";
import { ReportQuadrantChart } from "./report-quadrant-chart";
import { ReportPerLevelChart } from "./report-per-level-chart";

// subjectは共有ページ(他人が見る)では「この人」にする。
export function ComparisonSection({
  comparison,
  subject = "あなた",
}: {
  comparison: RiotReportComparison;
  subject?: string;
}) {
  const { participants, myReceived, average, median, moreThanMePercent, quadrant } = comparison;

  // 4象限は参加者が少なくても仮の境界線で出るので、通常ここには来ない(古いデータ形式向けの保険)。
  if (quadrant === null) {
    return (
      <p className="muted riot-compare-note">
        送信しました。ご協力ありがとうございます!現在の参加者は{participants}人です。参加者が
        {MIN_PARTICIPANTS_FOR_RANKING_LABEL}
        集まると、順位とみんなとの比較(4象限)が表示されるようになります。
      </p>
    );
  }

  const type = QUADRANTS[quadrant.type];
  return (
    <>
      <div className="card riot-compare-dist">
        <h3>{quadrant.provisional ? "タイプ診断(仮)" : "みんなとの比較"}</h3>
        <div className="rq-type">
          <span className="rq-type-emoji">{type.emoji}</span>
          <div>
            <p className="rq-type-name">
              {subject}は「{getTypeName(quadrant.type, quadrant.lean)}」
            </p>
            <p className="muted">{type.description}</p>
          </div>
        </div>
        {quadrant.lean !== "none" && (
          <p className="rq-lean">
            通報された理由は
            <strong style={{ color: LEANS[quadrant.lean].color }}>
              {LEANS[quadrant.lean].emoji} {LEANS[quadrant.lean].label}
            </strong>
            が多め(
            {quadrant.lean === "conduct"
              ? "暴言・態度など"
              : "放置・敵チームへの協力・ランク操作など"}
            )
          </p>
        )}
        <ReportQuadrantChart quadrant={quadrant} myReceived={myReceived} meLabel={subject} />
        {quadrant.provisional ? (
          <p className="muted" style={{ fontSize: "0.8rem" }}>
            ※ 参加者が{MIN_PARTICIPANTS_FOR_RANKING_LABEL}
            集まるまでは、仮の境界線(通報された回数 {quadrant.medianReceived}回・通報した回数{" "}
            {quadrant.medianMade}
            回より多いかどうか)でタイプを判定しています。集まった後は参加者の中央値で判定するため、タイプが変わることがあります。点はほかの参加者で、色は通報された理由の傾向です(現在の参加者
            {participants}人)。
          </p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: "0.8rem" }}>
              点線は参加者の中央値(通報された回数 {quadrant.medianReceived}回・通報した回数{" "}
              {quadrant.medianMade}回)です。点はほかの参加者({participants}
              人)で、色は通報された理由の傾向です。個人は特定できません。
            </p>
            <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
              {subject}より多く通報されている人は{moreThanMePercent}%。通報された回数の平均は
              {average}
              回・中央値は{median}
              回です。※
              lolwatchでデータを送信した人の中での比較で、LoLプレイヤー全体ではありません。
            </p>
          </>
        )}
      </div>
      <PerLevelSection comparison={comparison} subject={subject} />
    </>
  );
}

// 「レベル100あたりの通報された回数」の散布図。サモナーレベルを試合数の目安にしている。
function PerLevelSection({
  comparison,
  subject,
}: {
  comparison: RiotReportComparison;
  subject: string;
}) {
  const { perLevel, myReceived, quadrant } = comparison;
  if (perLevel.myPer100 === null && perLevel.points.length === 0) return null;
  return (
    <div className="card riot-compare-dist">
      <h3>試合数の目安(サモナーレベル)で割ると</h3>
      {perLevel.myPer100 !== null ? (
        <p className="rq-lean">
          {subject}はレベル{perLevel.myLevel}で、
          <strong>レベル100あたり {perLevel.myPer100}回</strong>
          通報されています
          {perLevel.topPercent !== null && <>(上位 {perLevel.topPercent}%)</>}。
        </p>
      ) : (
        <p className="muted">
          {subject}のサモナーレベルを取得できなかったため、ほかの参加者だけを表示しています。
        </p>
      )}
      <ReportPerLevelChart
        perLevel={perLevel}
        myReceived={myReceived}
        myLean={quadrant?.lean ?? "none"}
        meLabel={subject}
      />
      <p className="muted" style={{ fontSize: "0.8rem" }}>
        ※
        Riotのデータには試合数が含まれないため、サモナーレベルを試合数の目安にしています。右上ほど「回数が多く、しかも遊んだ量の割に多い」、右下ほど「回数は多いが、たくさん遊んでいるぶん多い」ことを表します。
      </p>
    </div>
  );
}
