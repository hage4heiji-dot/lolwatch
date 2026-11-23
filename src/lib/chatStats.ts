// Riotデータリクエストのzipに含まれるLoLのチャットログ(直近の試合ぶん・本人の発言のみ)を数値に要約する。
// 集計はブラウザ内で行い、メッセージ本文はサーバーへ送らない(送るのはChatSummaryの数値だけ)。

export type ChatSummary = {
  // チャットログが含まれていた試合数
  games: number;
  // 1回以上発言した試合数
  activeGames: number;
  // 発言数の合計(試合前・試合中・試合後)
  messages: number;
  // 全体チャット(敵チームにも見える)での発言数
  allMessages: number;
  // 強めの言葉を含む発言数(簡易判定)
  harshMessages: number;
};

// 強めの言葉の簡易判定用。誤検出を避けるため、日常語と紛れやすい短い語は入れない。
// 英単語は単語境界でだけ一致させる(「point」に「int」が一致する等を防ぐ)。
const HARSH_JA = [
  "死ね",
  "しね",
  "氏ね",
  "ゴミ",
  "雑魚",
  "ざこ",
  "ザコ",
  "下手くそ",
  "へたくそ",
  "ヘタクソ",
  "無能",
  "害悪",
  "消えろ",
  "きえろ",
  "アホ",
  "あほ",
  "バカ",
  "ばか",
  "馬鹿",
  "クソ",
  "くそ",
  "戦犯",
  "うざ",
  "キモ",
  "きも",
];
const HARSH_EN = /\b(noob|trash|kys|idiot|stupid|retard|fuck\w*|shit\w*|ez|gg\s*ez|loser|dog)\b/i;

export function isHarshMessage(text: string): boolean {
  const normalized = text.normalize("NFKC");
  return HARSH_JA.some((w) => normalized.includes(w)) || HARSH_EN.test(normalized);
}

type ChatLogFile = {
  chat_logs?: Record<string, { chat?: unknown; sent_to?: unknown }[] | undefined>;
};

// 1試合ぶんのチャットログ(JSON文字列)の配列から要約を作る。形式が想定外のファイルは無視する。
export function summarizeChatLogs(files: string[]): ChatSummary | null {
  const summary: ChatSummary = {
    games: 0,
    activeGames: 0,
    messages: 0,
    allMessages: 0,
    harshMessages: 0,
  };
  for (const text of files) {
    let json: ChatLogFile;
    try {
      json = JSON.parse(text) as ChatLogFile;
    } catch {
      continue;
    }
    if (typeof json?.chat_logs !== "object" || json.chat_logs === null) continue;
    summary.games++;
    let inThisGame = 0;
    for (const messages of Object.values(json.chat_logs)) {
      if (!Array.isArray(messages)) continue;
      for (const m of messages) {
        const chat = typeof m?.chat === "string" ? m.chat : "";
        inThisGame++;
        if (typeof m?.sent_to === "string" && m.sent_to.toUpperCase() === "ALL") {
          summary.allMessages++;
        }
        if (chat && isHarshMessage(chat)) summary.harshMessages++;
      }
    }
    summary.messages += inThisGame;
    if (inThisGame > 0) summary.activeGames++;
  }
  return summary.games > 0 ? summary : null;
}

// 表示用の派生値。
export function chatRates(s: ChatSummary) {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    // 発言した試合の割合(%)
    activeRate: round1((s.activeGames / s.games) * 100),
    // 1試合あたりの発言数
    perGame: Math.round((s.messages / s.games) * 100) / 100,
    // 全体チャットの割合(%)。発言が無ければ0
    allRate: s.messages > 0 ? round1((s.allMessages / s.messages) * 100) : 0,
  };
}
