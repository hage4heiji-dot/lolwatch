"use client";

// 読み込んだ「通報された回数」を結果カードで表示し、本人が同意した場合だけ匿名で送信して
// 他の参加者と比べた位置(上位○%・分布)を出す。送信後はXで共有できるようにする。
import { useState } from "react";
import type { RiotReportComparison } from "@/lib/riotReportStats";
import { buildShareText, topCategory } from "@/lib/reportCountTitle";
import { ReportCountCard } from "./report-count-card";

const SITE_URL = "https://lol-watch.com";

type Props = {
  // summoner.jsonが無いzipではnull(重複を防げないので送信はさせない)。
  riotIdHash: string | null;
  receivedByCategory: Record<string, number>;
  madeByCategory: Record<string, number>;
  penaltyCount: number;
};

function sum(m: Record<string, number>): number {
  return Object.values(m).reduce((a, b) => a + b, 0);
}

export function RiotReportCompare(props: Props) {
  const { riotIdHash, receivedByCategory, madeByCategory, penaltyCount } = props;
  const [comparison, setComparison] = useState<RiotReportComparison | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const received = sum(receivedByCategory);
  const made = sum(madeByCategory);

  async function submit() {
    if (!riotIdHash) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/riot-report-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riotIdHash, receivedByCategory, madeByCategory, penaltyCount }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.comparison) {
        setError(body?.error ?? "送信に失敗しました。時間をおいて再度お試しください。");
        return;
      }
      setComparison(body.comparison);
      setShareId(body.id ?? null);
    } catch {
      setError("送信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="riot-compare">
      <ReportCountCard
        received={received}
        made={made}
        penaltyCount={penaltyCount}
        topCategory={topCategory(receivedByCategory)}
        topPercent={comparison?.topPercent ?? null}
        participants={comparison?.participants ?? null}
      />

      {!comparison ? (
        <div className="riot-compare-consent">
          <button
            className="btn riot-compare-submit"
            type="button"
            onClick={submit}
            disabled={sending || !riotIdHash}
          >
            {sending ? "集計中…" : "📊 みんなと比べて順位を見る"}
          </button>
          {!riotIdHash && (
            <p className="error-text">
              zipにRiot IDの情報が見つからないため、比べる機能は使えません。
            </p>
          )}
          {error && <p className="error-text">{error}</p>}
          <details className="riot-compare-details">
            <summary>送信される内容(匿名)</summary>
            <ul>
              <li>LoLで通報された回数・通報した回数(理由別)とペナルティの件数</li>
              <li>
                同じアカウントが二重に数えられないための識別子(Riot IDから作った元に戻せない値。Riot
                ID自体は送信しません)
              </li>
            </ul>
            <p>
              zipファイルそのもの、Riot
              ID、メールアドレスなどは送信しません。送信した数値は統計にのみ使い、個人とは結びつけません。
            </p>
          </details>
        </div>
      ) : (
        <>
          {shareId && (
            <ShareActions
              shareId={shareId}
              received={received}
              topPercent={comparison.topPercent}
            />
          )}
          <Distribution comparison={comparison} />
        </>
      )}
    </div>
  );
}

function ShareActions({
  shareId,
  received,
  topPercent,
}: {
  shareId: string;
  received: number;
  topPercent: number | null;
}) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}/how-to-check-reports/result/${shareId}`;
  const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(
    buildShareText(received, topPercent),
  )}&url=${encodeURIComponent(url)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードAPIが使えない環境では何もしない
    }
  }

  return (
    <div className="riot-compare-share">
      <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className="btn riot-compare-x">
        𝕏 で結果をポスト
      </a>
      <button type="button" className="btn btn-secondary" onClick={copy}>
        {copied ? "コピーしました" : "結果のリンクをコピー"}
      </button>
      <p className="muted">共有されるのは上のカードの内容だけです。Riot IDは表示されません。</p>
    </div>
  );
}

function Distribution({ comparison }: { comparison: RiotReportComparison }) {
  const { participants, average, median, moreThanMePercent, distribution } = comparison;

  if (distribution === null) {
    return (
      <p className="muted riot-compare-note">
        送信しました。ご協力ありがとうございます!現在の参加者は{participants}
        人です。参加者が10人集まると順位が表示されるようになります。
      </p>
    );
  }

  const max = Math.max(...distribution.map((d) => d.count), 1);
  return (
    <div className="card riot-compare-dist">
      <h3>参加者の分布</h3>
      <p className="muted">
        あなたより多く通報されている人は{moreThanMePercent}%。平均{average}回・中央値{median}
        回(参加者
        {participants}人)。
      </p>
      <div style={{ marginTop: "0.9rem" }}>
        {distribution.map((d) => (
          <div className={`stat-bar-row${d.isMine ? " riot-compare-mine" : ""}`} key={d.label}>
            <span className="stat-bar-label">
              {d.isMine ? `▶ ${d.label}` : d.label}
            </span>
            <div className="stat-bar-track">
              <div className="stat-bar-fill" style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
            <span className="stat-bar-count">{d.count}人</span>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: "0.75rem" }}>
        ※
        lolwatchでデータを送信した人の中での位置です。LoLプレイヤー全体の中での位置ではありません。
      </p>
    </div>
  );
}
