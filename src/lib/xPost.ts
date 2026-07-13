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

// 「違反確認」告知の文面を組み立てる。未検証の通報件数ではなく、モデレーターが
// 実際に確認した結果のみを対象にすることを明示する(サイトのガイドライン方針と揃える)。
export function buildViolationAnnouncement(params: {
  categoryIcon: string;
  categoryLabel: string;
  riotId: string;
  championName: string;
  playerUrl: string;
}): string {
  const { categoryIcon, categoryLabel, riotId, championName, playerUrl } = params;
  return [
    `${categoryIcon} 違反確認: ${riotId}`,
    `カテゴリ: ${categoryLabel} / チャンピオン: ${championName}`,
    "モデレーターが実際にリプレイ等を確認の上、違反を確認しました。",
    playerUrl,
  ].join("\n");
}
