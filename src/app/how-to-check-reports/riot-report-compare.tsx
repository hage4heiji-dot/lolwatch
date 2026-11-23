"use client";

// 読み込んだ「通報された回数」を結果カードで表示し、本人が同意した場合だけ匿名で送信して
// 他の参加者と比べた位置(上位○%・分布)を出す。送信後はXで共有できるようにする。
import { useState } from "react";
import type { RiotReportComparison } from "@/lib/riotReportStats";
import {
  buildShareText,
  topCategory,
  type QuadrantKey,
  type ReportLean,
} from "@/lib/reportCountTitle";
import { ComparisonSection } from "./comparison-section";
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
        quadrantType={comparison?.quadrant?.type ?? null}
        lean={comparison?.quadrant?.lean ?? "none"}
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
              quadrantType={comparison.quadrant?.type ?? null}
              lean={comparison.quadrant?.lean ?? "none"}
            />
          )}
          <ComparisonSection comparison={comparison} />
        </>
      )}
    </div>
  );
}

function ShareActions({
  shareId,
  received,
  topPercent,
  quadrantType,
  lean,
}: {
  shareId: string;
  received: number;
  topPercent: number | null;
  quadrantType: QuadrantKey | null;
  lean: ReportLean;
}) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}/how-to-check-reports/result/${shareId}`;
  const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(
    buildShareText(received, topPercent, quadrantType, lean),
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
