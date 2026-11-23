// 「通報された回数」の結果カード。スクショ・共有されることを前提にした見た目。
// 読み込み直後の画面(クライアント)と共有ページ(サーバー)の両方で使うため、状態は持たない。
import type { CSSProperties } from "react";
import {
  getReportCountTitle,
  getTypeName,
  QUADRANTS,
  TONE_COLORS,
  type QuadrantKey,
  type ReportLean,
} from "@/lib/reportCountTitle";
import { chatRates, type ChatSummary } from "@/lib/chatStats";

export type ReportCountCardProps = {
  received: number;
  made: number;
  penaltyCount: number;
  topCategory: { label: string; count: number } | null;
  // 参加者が少なく順位が出ない間はnull。
  topPercent: number | null;
  // まだ送信しておらず参加者数が分からない間はnull。
  participants: number | null;
  // 4象限のタイプ。参加者不足・未送信ならnull。
  quadrantType?: QuadrantKey | null;
  // 通報された理由の傾向(タイプ名の頭に付く)。
  lean?: ReportLean;
  // レベル100あたりの通報された回数。未送信・レベル不明ならnull。
  per100?: number | null;
  // チャットログの要約。zipに無ければnull。
  chat?: ChatSummary | null;
};

export function ReportCountCard(props: ReportCountCardProps) {
  const { received, made, penaltyCount, topCategory, topPercent, participants } = props;
  const { quadrantType, lean = "none", per100 = null, chat = null } = props;
  const chatInfo = chat ? chatRates(chat) : null;
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

      {quadrantType && (
        <div className="rc-card-type">
          <span className="rc-card-type-emoji">{QUADRANTS[quadrantType].emoji}</span>
          <span>
            <span className="rc-card-type-label">タイプ</span>
            <span className="rc-card-type-name">
              {/* 狭い画面では「プレイ系・」の後で折り返す */}
              {getTypeName(quadrantType, lean)
                .split("・")
                .map((part, i) => (
                  <span key={i} className="rc-card-type-part">
                    {i > 0 ? "・" : ""}
                    {part}
                  </span>
                ))}
            </span>
          </span>
        </div>
      )}

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
        <div>
          <dt>Lv100あたり</dt>
          <dd>{per100 !== null ? `${per100}回` : "-"}</dd>
        </div>
      </dl>

      {chat && chatInfo && (
        <div className="rc-card-chat">
          <span className="rc-card-chat-label">💬 チャット(直近{chat.games}試合)</span>
          <span className="rc-card-chat-items">
            <span>
              発言した試合 <strong>{chatInfo.activeRate}%</strong>
            </span>
            <span>
              1試合 <strong>{chatInfo.perGame}回</strong>
            </span>
            <span>
              強めの言葉 <strong>{chat.harshMessages}回</strong>
            </span>
          </span>
        </div>
      )}

      <div className="rc-card-foot">lol-watch.com で自分の通報回数を調べる</div>
    </div>
  );
}
