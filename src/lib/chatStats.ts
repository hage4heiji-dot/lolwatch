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
export const HARSH_JA = [
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
// 判定に使っている英語の言葉(画面の説明にもそのまま出す)。fuck/shitは活用形(fucking等)も含める。
export const HARSH_EN_WORDS = [
  "noob",
  "trash",
  "kys",
  "idiot",
  "stupid",
  "retard",
  "fuck",
  "shit",
  "ez",
  "loser",
];
const HARSH_EN = new RegExp(
  `\\b(${HARSH_EN_WORDS.map((w) => (w === "fuck" || w === "shit" ? `${w}\\w*` : w)).join("|")})\\b`,
  "i",
);

// 強めの言葉が含まれていれば、引っかかった言葉を返す。
export function findHarshWord(text: string): string | null {
  const normalized = text.normalize("NFKC");
  const ja = HARSH_JA.find((w) => normalized.includes(w));
  if (ja) return ja;
  const en = normalized.match(HARSH_EN);
  return en ? en[0] : null;
}

// 強めの言葉と判定された発言の例(本人の画面に出すだけで、サーバーには送らない)。
export type HarshSample = { text: string; word: string; phase: string };
const MAX_HARSH_SAMPLES = 5;
const PHASE_LABELS: Record<string, string> = {
  pre_game: "試合前",
  in_game: "試合中",
  post_game: "試合後",
};

type ChatLogFile = {
  chat_logs?: Record<string, { chat?: unknown; sent_to?: unknown }[] | undefined>;
};

// 1試合ぶんのチャットログ(JSON文字列)の配列から要約を作る。形式が想定外のファイルは無視する。
// harshSamplesは本人の画面表示用で、summaryと違ってサーバーには送らない。
export function analyzeChatLogs(files: string[]): {
  summary: ChatSummary | null;
  harshSamples: HarshSample[];
} {
  const harshSamples: HarshSample[] = [];
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
    for (const [phase, messages] of Object.entries(json.chat_logs)) {
      if (!Array.isArray(messages)) continue;
      for (const m of messages) {
        const chat = typeof m?.chat === "string" ? m.chat : "";
        inThisGame++;
        if (typeof m?.sent_to === "string" && m.sent_to.toUpperCase() === "ALL") {
          summary.allMessages++;
        }
        const word = chat ? findHarshWord(chat) : null;
        if (word) {
          summary.harshMessages++;
          if (harshSamples.length < MAX_HARSH_SAMPLES) {
            harshSamples.push({ text: chat, word, phase: PHASE_LABELS[phase] ?? phase });
          }
        }
      }
    }
    summary.messages += inThisGame;
    if (inThisGame > 0) summary.activeGames++;
  }
  return { summary: summary.games > 0 ? summary : null, harshSamples };
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
