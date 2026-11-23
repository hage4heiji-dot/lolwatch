"use client";

// 読み込んだ「通報された回数」を、本人が同意した場合だけ匿名で送信し、
// 他の参加者と比べた位置(上位○%・分布)を表示する。
import { useState } from "react";
import type { RiotReportComparison } from "@/lib/riotReportStats";

type Props = {
  riotIdHash: string;
  receivedByCategory: Record<string, number>;
  madeByCategory: Record<string, number>;
  penaltyCount: number;
};

export function RiotReportCompare(props: Props) {
  const [comparison, setComparison] = useState<RiotReportComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/riot-report-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(props),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.comparison) {
        setError(body?.error ?? "送信に失敗しました。時間をおいて再度お試しください。");
        return;
      }
      setComparison(body.comparison);
    } catch {
      setError("送信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSending(false);
    }
  }

  if (comparison) return <CompareResult comparison={comparison} />;

  return (
    <div className="card riot-compare">
      <h3>📊 みんなと比べる</h3>
      <p>
        あなたの「通報された回数」が、参加者の中でどのくらいの位置かを表示します。比べるには、次の数値だけを匿名でlolwatchに送信します。
      </p>
      <ul className="muted" style={{ paddingLeft: "1.2rem", marginTop: "0.5rem" }}>
        <li>LoLで通報された回数・通報した回数(理由別)</li>
        <li>ペナルティの件数</li>
        <li>
          同じアカウントが二重に数えられないようにするための識別子(Riot IDから作った、元に戻せない値。Riot ID自体は送信しません)
        </li>
      </ul>
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        zipファイルそのもの、Riot ID、メールアドレスなどは送信しません。送信した数値は統計にのみ使い、個人とは結びつけません。
      </p>
      <button className="btn" type="button" onClick={submit} disabled={sending} style={{ marginTop: "0.75rem" }}>
        {sending ? "送信中…" : "匿名で送信して比べる"}
      </button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function CompareResult({ comparison }: { comparison: RiotReportComparison }) {
  const { participants, myReceived, topPercent, moreThanMePercent, average, median, distribution } =
    comparison;

  if (topPercent === null || distribution === null) {
    return (
      <div className="card riot-compare">
        <h3>📊 みんなと比べる</h3>
        <p>
          送信しました。ご協力ありがとうございます!現在の参加者は<strong>{participants}人</strong>
          です。参加者が集まったら、ここであなたの位置を表示できるようになります。時間をおいてもう一度読み込んでみてください。
        </p>
      </div>
    );
  }

  const max = Math.max(...distribution.map((d) => d.count), 1);
  return (
    <div className="card riot-compare">
      <h3>📊 みんなと比べる</h3>
      {myReceived === 0 ? (
        // 0回だと「上位100%」になって分かりにくいので、0回の人の割合で表現する。
        <p className="riot-compare-headline">
          あなたは一度も通報されていません。通報0回の人は参加者{participants}人中
          <span className="riot-compare-rank">{Math.round((100 - moreThanMePercent!) * 10) / 10}%</span>
        </p>
      ) : (
        <p className="riot-compare-headline">
          あなたの通報された回数 <strong>{myReceived}回</strong> は、参加者{participants}人中
          <span className="riot-compare-rank">上位 {topPercent}%</span>
        </p>
      )}
      <p className="muted">
        あなたより多く通報されている人は{moreThanMePercent}%です。参加者の平均は{average}回、中央値は{median}回です。
      </p>
      <div style={{ marginTop: "0.9rem" }}>
        {distribution.map((d) => (
          <div className={`stat-bar-row${d.isMine ? " riot-compare-mine" : ""}`} key={d.label}>
            <span className="stat-bar-label">
              {d.label}
              {d.isMine ? " ← あなた" : ""}
            </span>
            <div className="stat-bar-track">
              <div className="stat-bar-fill" style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
            <span className="stat-bar-count">{d.count}人</span>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: "0.75rem" }}>
        ※ lolwatchでデータを送信した人の中での位置です。LoLプレイヤー全体の中での位置ではありません。
      </p>
    </div>
  );
}
