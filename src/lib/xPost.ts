import crypto from "crypto";

// X(Twitter) API v2への投稿。OAuth 1.0a User Context(APIキー+アクセストークン)を
// 使う。認証情報が1つでも未設定の場合は「機能オフ」として何もしない
// (この機能を使わない運用も自然にできるようにするための設計)。
const API_KEY = process.env.X_API_KEY;
const API_SECRET = process.env.X_API_SECRET;
const ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
const ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

export const isXPostConfigured = Boolean(
  API_KEY && API_SECRET && ACCESS_TOKEN && ACCESS_TOKEN_SECRET,
);

export class XPostError extends Error {}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

// OAuth 1.0a署名。JSONボディはform-urlencodedではないため署名対象に含めない
// (Twitter/Xの仕様上、署名base stringに含めるのはoauth_*パラメータとクエリ文字列のみ)。
function buildOAuthHeader(method: string, url: string): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: API_KEY!,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN!,
    oauth_version: "1.0",
  };

  const paramString = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(oauthParams[key])}`)
    .join("&");

  const signatureBase = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join(
    "&",
  );
  const signingKey = `${percentEncode(API_SECRET!)}&${percentEncode(ACCESS_TOKEN_SECRET!)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(signatureBase).digest("base64");

  const headerParams: Record<string, string> = { ...oauthParams, oauth_signature: signature };
  return (
    "OAuth " +
    Object.keys(headerParams)
      .sort()
      .map((key) => `${percentEncode(key)}="${percentEncode(headerParams[key])}"`)
      .join(", ")
  );
}

export async function postToX(text: string): Promise<void> {
  if (!isXPostConfigured) return;

  const url = "https://api.twitter.com/2/tweets";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: buildOAuthHeader("POST", url),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new XPostError(`X API error: ${res.status} ${body}`);
  }
}

// 2026-07-16に実投稿(note_tweet)で実機検証済み: このアカウントは280文字制限を
// 受けず25,000文字まで投稿できる。日次まとめは内容自体が元々シンプル(名前+件数の
// 羅列)なので大半の日はこの上限に近づきもしない。「異常に多くの違反確認が出た日」
// だけの安全弁として、実用上まず到達しない余裕のある上限にしておく。
const MAX_TWEET_LENGTH = 4000;

// Xの文字数カウントはtwitter-textの重み付けルールに基づき、ASCII等は1文字=1、
// 日本語(かな/漢字)や絵文字などそれ以外は1文字=2として数える。string.lengthの
// 単純な文字数では日本語主体の文面で上限を大きく過小評価してしまうため必須。
const WEIGHT_ONE_RANGES: [number, number][] = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];

function weightedTweetLength(text: string): number {
  let length = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    const isWeightOne = WEIGHT_ONE_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
    length += isWeightOne ? 1 : 2;
  }
  return length;
}

// URL付きの投稿はリンククリックの計測扱いでXの課金が跳ね上がるため、投稿本文には
// リンクを含めない。サイトへの導線はプロフィール欄のリンクに任せる方針。
// そのため、URLの代わりに誘導する一文を全投稿の末尾に必ず添える。
const PROFILE_CTA = "🔗詳しくはプロフィールのリンクから";

const SELF_INTRO_LINES = [
  "🔎 lolwatchとは",
  "LoLの試合中の暴言・チート・意図的な敗北行為などを、試合IDから誰でも通報できる非公式の監視サイトです。",
];

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// 毎日同じ文面だと機械的な印象になるため、見出し/0件時メッセージだけ複数パターンから
// ランダムに選ぶ。ユーザーの違反確認結果(entries)の記述フォーマットはここでは揺らさない
// (通報された側の表記を投稿ごとにブレさせないため)。
const HEADER_TEMPLATES = (dateLabel: string): string[] => [
  `⚠️ ${dateLabel}に違反を確認したユーザー`,
  `🚨 ${dateLabel}、違反が確認されたのはこの方々です`,
  `📋 ${dateLabel}分の違反確認レポート`,
  `⚠️ モデレーターが${dateLabel}に違反を確認したプレイヤー一覧`,
];

const NO_VIOLATION_TEMPLATES = (dateLabel: string): string[] => [
  `${dateLabel}は、新たに違反確認されたユーザーはいませんでした。`,
  `${dateLabel}分の違反確認はありませんでした。`,
  `${dateLabel}は違反確認ゼロでした。`,
];

// 前日に「違反確認」となったユーザーの日次まとめ文面を組み立てる。未検証の通報件数
// ではなく、モデレーターが実際に確認した結果のみを対象にすることを明示する
// (サイトのガイドライン方針と揃える)。MAX_TWEET_LENGTH(X実際の重み付きカウント)に
// 収まらない極端なケースだけ、入りきらない分を「…ほかN人」に丸める。対象0件の日は、
// 無投稿にせずサイトの自己紹介を投稿する(Xアカウントの投稿間隔を空けすぎないため)。
export function buildDailyViolationDigest(params: {
  dateLabel: string;
  entries: { riotId: string; count: number }[];
}): string {
  const { dateLabel, entries } = params;
  if (entries.length === 0) {
    return [
      ...SELF_INTRO_LINES,
      pickRandom(NO_VIOLATION_TEMPLATES(dateLabel)),
      "",
      PROFILE_CTA,
    ].join("\n");
  }

  const header = pickRandom(HEADER_TEMPLATES(dateLabel));

  const render = (includedCount: number): string => {
    const lines = entries
      .slice(0, includedCount)
      .map((e, i) => `${i + 1}. ${e.riotId}(${e.count}件)`);
    const omitted = entries.length - includedCount;
    if (omitted > 0) lines.push(`…ほか${omitted}人`);
    return [header, "", ...lines, "", PROFILE_CTA].join("\n");
  };

  for (let included = entries.length; included >= 0; included -= 1) {
    const text = render(included);
    if (weightedTweetLength(text) <= MAX_TWEET_LENGTH || included === 0) return text;
  }
  // ここには到達しない(includedが0までのループが必ずreturnする)。
  return render(0);
}
