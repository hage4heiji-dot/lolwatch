// 「みんなとの比較」欄(4象限・レベルあたり散布図・チャットの傾向)。
// 読み込み直後の画面と共有ページの両方で使うため状態は持たない。結果カードと同じ暗いパネルで統一する。
import type { CSSProperties, ReactNode } from "react";
import type { RiotReportComparison } from "@/lib/riotReportStats";
import { getTypeName, LEANS, QUADRANTS } from "@/lib/reportCountTitle";
import { chatRates } from "@/lib/chatStats";
import { DISTRIBUTION_STEP } from "@/lib/reportChartScale";
import { MIN_PARTICIPANTS_FOR_RANKING_LABEL } from "./constants";
import { ReportQuadrantChart } from "./report-quadrant-chart";
import { ReportPerLevelChart } from "./report-per-level-chart";

function Panel({
  kicker,
  title,
  badge,
  accent,
  children,
}: {
  kicker: string;
  title: string;
  badge?: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <section className="rq-panel" style={{ "--rq-accent": accent } as CSSProperties}>
      <header className="rq-panel-head">
        <div>
          <span className="rq-panel-kicker">{kicker}</span>
          <h3 className="rq-panel-title">{title}</h3>
        </div>
        {badge && <span className="rq-panel-badge">{badge}</span>}
      </header>
      {children}
    </section>
  );
}

function MiniStats({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="rq-mini-stats">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

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
        送信しました。ご協力ありがとうございます!現在の参加者は{participants}人です。
      </p>
    );
  }

  const type = QUADRANTS[quadrant.type];
  return (
    <>
      <Panel
        kicker={quadrant.provisional ? "TYPE ・ 仮判定" : "TYPE ・ みんなとの比較"}
        title="通報する × 通報される"
        badge={`参加者 ${participants}人`}
        accent={type.color}
      >
        <div className="rq-hero">
          <span className="rq-hero-emoji">{type.emoji}</span>
          <div className="rq-hero-body">
            <span className="rq-hero-label">{subject}のタイプ</span>
            <span className="rq-hero-name">{getTypeName(quadrant.type, quadrant.lean)}</span>
            <span className="rq-hero-desc">{type.description}</span>
          </div>
        </div>
        {quadrant.lean !== "none" && (
          <p
            className="rq-chip"
            style={{ "--rq-chip": LEANS[quadrant.lean].color } as CSSProperties}
          >
            {LEANS[quadrant.lean].emoji} 通報された理由は
            <strong>{LEANS[quadrant.lean].label}</strong>
            が多め
            <span className="rq-chip-sub">
              (
              {quadrant.lean === "conduct"
                ? "暴言・態度など"
                : "放置・敵チームへの協力・ランク操作など"}
              )
            </span>
          </p>
        )}

        <ReportQuadrantChart quadrant={quadrant} myReceived={myReceived} meLabel={subject} />

        {!quadrant.provisional && (
          <MiniStats
            items={[
              { label: "より多く通報されている人", value: `${moreThanMePercent}%` },
              { label: "通報された回数の平均", value: `${average}回` },
              { label: "中央値", value: `${median}回` },
            ]}
          />
        )}
        <p className="rq-note">
          {quadrant.provisional
            ? `※ 参加者が${MIN_PARTICIPANTS_FOR_RANKING_LABEL}集まるまでは、仮の境界線(通報された回数${quadrant.medianReceived}回・通報した回数${quadrant.medianMade}回より多いか)でタイプを判定しています。集まった後は参加者の中央値で判定するため、タイプが変わることがあります。`
            : `※ 境界線は参加者の中央値(通報された回数${quadrant.medianReceived}回・通報した回数${quadrant.medianMade}回)です。lolwatchでデータを送信した人の中での比較です。`}
          点はほかの参加者で、色は通報された理由の傾向です。個人は特定できません。
        </p>
      </Panel>
      <DistributionSection comparison={comparison} subject={subject} />
      <PerLevelSection comparison={comparison} subject={subject} />
      <ChatSection comparison={comparison} subject={subject} />
    </>
  );
}

// 通報された回数の分布(20回刻みの棒グラフ)。自分のいる棒だけ色を付ける。
function DistributionSection({
  comparison,
  subject,
}: {
  comparison: RiotReportComparison;
  subject: string;
}) {
  const { distribution, participants, myReceived } = comparison;
  if (!distribution || distribution.length === 0) return null;
  const max = Math.max(...distribution.map((b) => b.count), 1);
  return (
    <Panel
      kicker={`DISTRIBUTION ・ ${DISTRIBUTION_STEP}回ごと`}
      title="通報された回数の分布"
      badge={`${subject} ${myReceived}回`}
      accent="#ffb547"
    >
      <div
        className="rq-hist"
        role="img"
        aria-label={`通報された回数の分布。${subject}は${
          distribution.find((b) => b.isMine)?.label ?? ""
        }回の区間`}
      >
        {distribution.map((bin) => (
          <div className={`rq-hist-col${bin.isMine ? " rq-hist-col-me" : ""}`} key={bin.label}>
            <span className="rq-hist-count">{bin.count}人</span>
            <div className="rq-hist-track">
              <i
                style={{ height: `${Math.max((bin.count / max) * 100, bin.count > 0 ? 4 : 0)}%` }}
              />
            </div>
            {/* 本数が多いとスマホで入りきらないので下限の数字だけにする(最後は「180+」) */}
            <span className="rq-hist-label">
              {distribution.length > 5
                ? bin.label.endsWith("〜")
                  ? `${bin.label.slice(0, -1)}+`
                  : bin.label.split("〜")[0]
                : bin.label}
            </span>
            {bin.isMine && <span className="rq-hist-me">{subject}</span>}
          </div>
        ))}
      </div>
      <p className="rq-note">
        ※ 横は通報された回数(累計、{DISTRIBUTION_STEP}
        回ごとの区間)、縦はその区間の人数です。lolwatchでデータを送信した参加者
        {participants}人の分布です。
      </p>
    </Panel>
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
    <Panel
      kicker="PER LEVEL ・ 遊んだ量で割ると"
      title="レベル100あたりの通報"
      badge={perLevel.myLevel ? `Lv ${perLevel.myLevel}` : undefined}
      accent="#ff5a5f"
    >
      {perLevel.myPer100 !== null ? (
        <div className="rq-metric">
          <span className="rq-metric-value">{perLevel.myPer100}</span>
          <span className="rq-metric-unit">回 / Lv100</span>
          {perLevel.topPercent !== null && (
            <span className="rq-metric-rank">上位 {perLevel.topPercent}%</span>
          )}
        </div>
      ) : (
        <p className="rq-note">
          {subject}のサモナーレベルを取得できなかったため、ほかの参加者だけを表示しています。
        </p>
      )}
      <ReportPerLevelChart
        perLevel={perLevel}
        myReceived={myReceived}
        myLean={quadrant?.lean ?? "none"}
        meLabel={subject}
      />
      <p className="rq-note">
        ※
        Riotのデータには試合数が含まれないため、サモナーレベルを試合数の目安にしています。右上ほど「回数が多く、しかも遊んだ量の割に多い」ことを表します。
      </p>
    </Panel>
  );
}

// チャットログ(直近の試合ぶん)の要約。参加者が集まれば平均と横棒で比べる。
function ChatSection({
  comparison,
  subject,
}: {
  comparison: RiotReportComparison;
  subject: string;
}) {
  const { mine, average, participants } = comparison.chat;
  if (!mine) return null;
  const rates = chatRates(mine);
  const harshPer100 = Math.round((mine.harshMessages / mine.games) * 1000) / 10;
  const tiles = [
    {
      icon: "🗣️",
      label: "発言した試合",
      mine: rates.activeRate,
      avg: average?.activeRate ?? null,
      unit: "%",
    },
    {
      icon: "💬",
      label: "1試合の発言",
      mine: rates.perGame,
      avg: average?.perGame ?? null,
      unit: "回",
    },
    {
      icon: "🧂",
      label: "強めの言葉 /100試合",
      mine: harshPer100,
      avg: average?.harshPer100Games ?? null,
      unit: "回",
    },
  ];
  return (
    <Panel
      kicker="CHAT ・ チャットの傾向"
      title={`直近${mine.games}試合のチャット`}
      badge={`発言 ${mine.messages}回`}
      accent="#e0459b"
    >
      <div className="rq-chat-tiles">
        {tiles.map((t) => {
          const max = Math.max(t.mine, t.avg ?? 0, 0.0001);
          return (
            <div className="rq-chat-tile" key={t.label}>
              <span className="rq-chat-label">
                {t.icon} {t.label}
              </span>
              <span className="rq-chat-value">
                {t.mine}
                <small>{t.unit}</small>
              </span>
              <div className="rq-chat-bars">
                <div className="rq-chat-bar">
                  <span>{subject}</span>
                  <i style={{ width: `${(t.mine / max) * 100}%` }} className="rq-chat-bar-me" />
                </div>
                <div className="rq-chat-bar">
                  <span>平均</span>
                  {t.avg !== null ? (
                    <i style={{ width: `${(t.avg / max) * 100}%` }} className="rq-chat-bar-avg" />
                  ) : (
                    <em>集計中</em>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="rq-note">
        ※ {subject}の発言のみを集計しています(全体チャット{mine.allMessages}
        回)。「強めの言葉」は決まった言葉が含まれる発言を数えた簡易判定で、文脈は考慮していません。
        {average
          ? `平均はチャットログを送信した参加者${participants}人のものです。`
          : `平均は、チャットログを送信した参加者が10人集まると表示されます(現在${participants}人)。`}
      </p>
    </Panel>
  );
}
