// 強めの言葉と判定された発言の例。本人の画面に出すだけで、サーバーには送らない
// (結果カード・共有ページ・OGP画像にも出さない)。
import { HARSH_EN_WORDS, HARSH_JA, type ChatSummary, type HarshSample } from "@/lib/chatStats";

// 引っかかった言葉を強調表示する。
function Highlighted({ text, word }: { text: string; word: string }) {
  const normalized = text.normalize("NFKC");
  const index = normalized.toLowerCase().indexOf(word.toLowerCase());
  if (index < 0) return <>{normalized}</>;
  return (
    <>
      {normalized.slice(0, index)}
      <mark className="harsh-mark">{normalized.slice(index, index + word.length)}</mark>
      {normalized.slice(index + word.length)}
    </>
  );
}

export function HarshSamples({ chat, samples }: { chat: ChatSummary; samples: HarshSample[] }) {
  return (
    <div className="card harsh-samples">
      <h3>🧂 強めの言葉の判定</h3>
      {samples.length === 0 ? (
        <p>直近{chat.games}試合のチャットに、強めの言葉は見つかりませんでした。</p>
      ) : (
        <>
          <p>
            直近{chat.games}試合で<strong>{chat.harshMessages}回</strong>
            、強めの言葉を含む発言がありました
            {chat.harshMessages > samples.length ? `(うち${samples.length}件を表示)` : ""}。
          </p>
          <ul className="harsh-list">
            {samples.map((s, i) => (
              <li key={i}>
                <span className="harsh-phase">{s.phase}</span>
                <span className="harsh-text">
                  <Highlighted text={s.text} word={s.word} />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted harsh-note">
        🔒
        この欄はあなたの画面にだけ表示しています。発言の内容はlolwatchに送信されず、結果カードや共有ページにも載りません。
      </p>
      <details className="harsh-words">
        <summary>判定に使っている言葉の一覧</summary>
        <p>{[...HARSH_JA, ...HARSH_EN_WORDS].join("、")}</p>
        <p className="muted">
          これらの言葉が含まれる発言を数えるだけの簡易判定で、文脈(冗談・自虐など)は考慮していません。
        </p>
      </details>
    </div>
  );
}
