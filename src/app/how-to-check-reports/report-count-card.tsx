// 「通報された回数」の結果カード。スクショ・共有されることを前提にした見た目。
// 読み込み直後の画面(クライアント)と共有ページ(サーバー)の両方で使うため、状態は持たない。
import type { CSSProperties } from "react";
import { getReportCountTitle, TONE_COLORS } from "@/lib/reportCountTitle";

export type ReportCountCardProps = {
  received: number;
  made: number;
  penaltyCount: number;
  topCategory: { label: string; count: number } | null;
  // 参加者が少なく順位が出ない間はnull。
  topPercent: number | null;
  // まだ送信しておらず参加者数が分からない間はnull。
  participants: number | null;
};

export function ReportCountCard(props: ReportCountCardProps) {
  const { received, made, penaltyCount, topCategory, topPercent, participants } = props;
  const { title, tone } = getReportCountTitle(received);
  const colors = TONE_COLORS[tone];
  const style = { "--rc-accent": colors.accent, "--rc-glow": colors.glow } as CSSProperties;

  const rankText =
    participants === null
      ? "みんなと比べると…?"
      : topPercent === null
        ? `参加者 ${participants}人 集計中`
        : received === 0
          ? `参加者${participants}人中 通報0回`
          : `参加者${participants}人中 上位 ${topPercent}%`;

  return (
    <div className="rc-card" style={style}>
      <div className="rc-card-head">
        <span className="rc-card-brand">LOLWATCH</span>
        <span className="rc-card-kicker">LoL 通報された回数</span>
      </div>

      <div className="rc-card-main">
        <span className="rc-card-number">{received}</span>
        <span className="rc-card-unit">回</span>
      </div>

      <div className="rc-card-title">
        <span className="rc-card-title-label">称号</span>
        <span className="rc-card-title-value">{title}</span>
      </div>

      <div className="rc-card-rank">{rankText}</div>

      <dl className="rc-card-stats">
        <div>
          <dt>最も多い理由</dt>
          <dd>
            {topCategory ? (
              <>
                {topCategory.label} {topCategory.count}回
              </>
            ) : (
              "なし"
            )}
          </dd>
        </div>
        <div>
          <dt>通報した回数</dt>
          <dd>{made}回</dd>
        </div>
        <div>
          <dt>ペナルティ</dt>
          <dd>{penaltyCount}件</dd>
        </div>
      </dl>

      <div className="rc-card-foot">lol-watch.com で自分の通報回数を調べる</div>
    </div>
  );
}
