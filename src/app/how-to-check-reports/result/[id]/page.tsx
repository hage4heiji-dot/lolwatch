import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRiotReportComparison, getRiotReportStatForShare } from "@/lib/riotReportStats";
import { getReportCountTitle, topCategory } from "@/lib/reportCountTitle";
import { ReportCountCard } from "../../report-count-card";

// Xで共有された「通報された回数」の結果ページ。順位は参加者の増減で変わるので毎回集計する。
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function asCounts(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).filter((e): e is [string, number] => typeof e[1] === "number"),
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const stat = await getRiotReportStatForShare(id);
  if (!stat) return { title: "通報された回数の結果" };
  const { title } = getReportCountTitle(stat.receivedTotal);
  return {
    title: `LoLで通報された回数: ${stat.receivedTotal}回「${title}」`,
    description:
      "Riotのデータリクエストで、LoLで自分が通報された回数を調べた結果です。あなたも何回通報されているか調べてみませんか?",
    // 個々の結果ページは検索結果に出す必要がない(解説ページ側に集約する)。
    robots: { index: false, follow: true },
  };
}

export default async function ReportCountResultPage({ params }: Params) {
  const { id } = await params;
  const stat = await getRiotReportStatForShare(id);
  if (!stat) notFound();

  const comparison = await getRiotReportComparison(stat.receivedTotal);

  return (
    <div className="rc-result-page">
      <p className="muted">LoLで自分が通報された回数を調べた結果</p>
      <ReportCountCard
        received={stat.receivedTotal}
        made={stat.madeTotal}
        penaltyCount={stat.penaltyCount}
        topCategory={topCategory(asCounts(stat.receivedByCategory))}
        topPercent={comparison.topPercent}
        participants={comparison.participants}
      />

      <Link href="/how-to-check-reports" className="game-cta rc-result-cta">
        <span className="game-cta-title">🔍 あなたは何回通報されてる?</span>
        <span className="game-cta-sub">
          Riotのデータリクエストで届いたファイルを読み込むだけ。ファイルはサーバーに送信されません。
        </span>
      </Link>

      <p className="muted" style={{ fontSize: "0.8rem" }}>
        ※ 回数は本人がRiotのデータをもとに送信した値です。順位はlolwatchでデータを送信した人の中での位置です。
      </p>
    </div>
  );
}
