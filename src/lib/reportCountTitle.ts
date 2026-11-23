// Riotデータリクエストの「通報された回数」まわりの表示用定義。
// 結果カード(ブラウザ)・共有ページ・OGP画像(サーバー)の両方から使うので、
// DBやnode専用モジュールには依存させない。

// Riot側のカテゴリ名 → 表示名。未知のカテゴリは元の値をそのまま出す。
export const RIOT_REPORT_CATEGORY_LABELS: Record<string, string> = {
  ASSISTING_ENEMY_TEAM: "敵チームへの協力",
  BOTTING: "Bot・自動操作",
  LEAVING_AFK: "放置・途中離脱",
  RANK_MANIPULATION: "ランク操作",
  VERBAL_ABUSE: "暴言",
  NEGATIVE_ATTITUDE: "ネガティブな態度",
  HATE_SPEECH: "ヘイトスピーチ",
  INAPPROPRIATE_NAME: "不適切な名前",
  OFFENSIVE_NAME: "不適切な名前",
  INTENTIONAL_FEEDING: "故意のフィード",
  CHEATING: "チート",
  THIRD_PARTY_TOOLS: "外部ツールの使用",
  SPAMMING: "スパム",
  GRIEFING: "妨害行為",
};

export function riotReportCategoryLabel(key: string): string {
  return RIOT_REPORT_CATEGORY_LABELS[key] ?? key;
}

export type ReportCountTitle = {
  title: string;
  // カードの色味。回数が多いほど赤系にする。
  tone: "saint" | "good" | "normal" | "warning" | "danger" | "legend";
};

// 通報された回数に応じた称号。参加者数に左右されないよう回数の絶対値で決める
// (参加者が少ない間でも共有したくなる要素を出すため)。自分で共有する前提の軽いネタなので、
// 他人を断罪するような強い言葉は避ける。
export function getReportCountTitle(received: number): ReportCountTitle {
  if (received === 0) return { title: "聖人サモナー", tone: "saint" };
  if (received < 5) return { title: "善良な市民", tone: "good" };
  if (received < 15) return { title: "たまにやらかす人", tone: "normal" };
  if (received < 30) return { title: "要注意人物", tone: "warning" };
  if (received < 60) return { title: "常連の被告人", tone: "danger" };
  return { title: "伝説の存在", tone: "legend" };
}

export function topCategory(
  counts: Record<string, number>,
): { label: string; count: number } | null {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  const [key, count] = entries.sort((a, b) => b[1] - a[1])[0];
  return { label: riotReportCategoryLabel(key), count };
}

export const TONE_COLORS: Record<ReportCountTitle["tone"], { accent: string; glow: string }> = {
  saint: { accent: "#7fe3c3", glow: "rgba(127, 227, 195, 0.35)" },
  good: { accent: "#7cb8ff", glow: "rgba(124, 184, 255, 0.35)" },
  normal: { accent: "#c8aa6e", glow: "rgba(200, 170, 110, 0.35)" },
  warning: { accent: "#ff9f43", glow: "rgba(255, 159, 67, 0.38)" },
  danger: { accent: "#ff5a5f", glow: "rgba(255, 90, 95, 0.4)" },
  legend: { accent: "#d68bff", glow: "rgba(214, 139, 255, 0.42)" },
};

// Xの共有文。URLは別途intentのurlパラメータで付ける。
export function buildShareText(
  received: number,
  topPercent: number | null,
  quadrantType: QuadrantKey | null = null,
  lean: ReportLean = "none",
): string {
  const { title } = getReportCountTitle(received);
  const rank = topPercent !== null && received > 0 ? `(上位${topPercent}%)` : "";
  const type = quadrantType
    ? `\nタイプは${QUADRANTS[quadrantType].emoji}${getTypeName(quadrantType, lean)}`
    : "";
  return `LoLで自分が通報された回数を調べたら${received}回、称号は「${title}」でした${rank}${type}\nあなたは何回?\n#LoL #lolwatch`;
}

export type QuadrantKey = "clash" | "guardian" | "oops" | "peace";

export const QUADRANTS: Record<QuadrantKey, { emoji: string; name: string; description: string }> =
  {
    clash: {
      emoji: "⚔️",
      name: "バチバチ交戦型",
      description: "通報されるのも通報するのも多め。試合が熱くなりがち。",
    },
    guardian: {
      emoji: "🛡️",
      name: "風紀委員型",
      description: "通報されるのは少なく、通報するのは多め。サモナーズリフトの秩序を守る人。",
    },
    oops: {
      emoji: "💥",
      name: "うっかりやらかし型",
      description: "通報されるのは多めで、自分からはあまり通報しない。心当たりは…?",
    },
    peace: {
      emoji: "🕊️",
      name: "平和主義型",
      description: "通報されるのも通報するのも少なめ。穏やかにプレイする人。",
    },
  };

// 参加者の中央値より「多い」かどうかで4象限に分ける(中央値ちょうどは「少ない」側)。
export function getQuadrant(
  received: number,
  made: number,
  medianReceived: number,
  medianMade: number,
): QuadrantKey {
  const highReceived = received > medianReceived;
  const highMade = made > medianMade;
  if (highReceived && highMade) return "clash";
  if (highMade) return "guardian";
  if (highReceived) return "oops";
  return "peace";
}

// 通報された理由の傾向。4象限の点の色と、タイプ名の頭に付ける。
export type ReportLean = "conduct" | "play" | "none";

const CONDUCT_CATEGORIES = new Set([
  "VERBAL_ABUSE",
  "NEGATIVE_ATTITUDE",
  "HATE_SPEECH",
  "INAPPROPRIATE_NAME",
  "OFFENSIVE_NAME",
  "SPAMMING",
]);

const PLAY_CATEGORIES = new Set([
  "ASSISTING_ENEMY_TEAM",
  "LEAVING_AFK",
  "RANK_MANIPULATION",
  "INTENTIONAL_FEEDING",
  "GRIEFING",
  "BOTTING",
  "CHEATING",
  "THIRD_PARTY_TOOLS",
]);

export const LEANS: Record<ReportLean, { emoji: string; label: string; color: string }> = {
  conduct: { emoji: "💬", label: "言動系", color: "#e0459b" },
  play: { emoji: "🎮", label: "プレイ系", color: "#f08c1a" },
  none: { emoji: "", label: "傾向なし", color: "#9a9aa2" },
};

// 通報された理由を言動系/プレイ系に分け、多いほうを傾向とする(同数・0回・未知のカテゴリのみなら"none")。
export function getReportLean(receivedByCategory: Record<string, number>): ReportLean {
  let conduct = 0;
  let play = 0;
  for (const [key, count] of Object.entries(receivedByCategory)) {
    if (CONDUCT_CATEGORIES.has(key)) conduct += count;
    else if (PLAY_CATEGORIES.has(key)) play += count;
  }
  if (conduct > play) return "conduct";
  if (play > conduct) return "play";
  return "none";
}

// タイプの表示名。通報された回数が多い象限(clash/oops)だけ傾向を頭に付ける
// (「言動系・平和主義型」のような不自然な組み合わせを避けるため)。
export function getTypeName(type: QuadrantKey, lean: ReportLean): string {
  const base = QUADRANTS[type].name;
  if (lean === "none" || (type !== "clash" && type !== "oops")) return base;
  return `${LEANS[lean].label}・${base}`;
}
