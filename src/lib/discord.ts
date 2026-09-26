// 管理者用DiscordサーバーへのWebhook通知。チャンネルごとに別のWebhook URLを環境変数で
// 受け取り、未設定のチャンネルへの通知は何もしない(xPost.tsと同じく「未設定=機能オフ」)。
// 通知はあくまで補助的なものなので、失敗しても例外は投げずログに残すだけにする。
const WEBHOOK_URLS = {
  // 通報・削除申請・異議・コメント通報・Bot下書きなど、管理者の対応が必要なもの
  alerts: process.env.DISCORD_WEBHOOK_URL_ALERTS,
  // 記事の公開・新着コメントなど、サイト上の動き
  activity: process.env.DISCORD_WEBHOOK_URL_ACTIVITY,
  // workerのバッチ処理の結果・エラー
  batch: process.env.DISCORD_WEBHOOK_URL_BATCH,
} as const;

export type DiscordChannel = keyof typeof WEBHOOK_URLS;

export const SITE_URL = "https://lol-watch.com";

// Discordの制限(embed description 4096字、field value 1024字)より余裕を持って切り詰める。
const MAX_DESCRIPTION = 1000;
const MAX_FIELD_VALUE = 500;
const TIMEOUT_MS = 5000;

export const DISCORD_COLORS = {
  red: 0xff6b4a,
  yellow: 0xf5c542,
  blue: 0x7c93ff,
  green: 0x4caf50,
  gray: 0x888888,
} as const;

// 表示の構成: label(上段の小さい見出し=通知の種類) → title(対象。urlがあればリンク) →
// description → fields(inline指定のものは横並び) → image。thumbnailは右上の小さい画像。種類と対象を分けることで、
// チャンネルを流し見したときに何の通知かがlabelだけで判別できるようにする。
export type DiscordNotification = {
  label: string;
  title: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  thumbnailUrl?: string;
  imageUrl?: string;
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// ユーザー投稿などの本文を引用ブロックとして表示する(サイト側の文言と区別しやすくするため)。
export function discordQuote(text: string, max = MAX_FIELD_VALUE): string {
  return truncate(text.trim(), max)
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

// スタックトレース等をコードブロックで表示する。
export function discordCodeBlock(text: string, max = 800): string {
  const fence = "```";
  return `${fence}\n${truncate(text.replaceAll(fence, "'''"), max)}\n${fence}`;
}

export async function notifyDiscord(
  channel: DiscordChannel,
  notification: DiscordNotification,
): Promise<void> {
  const webhookUrl = WEBHOOK_URLS[channel];
  if (!webhookUrl) return;

  const embed = {
    author: { name: truncate(notification.label, 250) },
    title: truncate(notification.title, 250),
    description: notification.description
      ? truncate(notification.description, MAX_DESCRIPTION)
      : undefined,
    url: notification.url,
    color: notification.color,
    fields: notification.fields
      ?.filter((field) => field.value)
      .map((field) => ({
        name: truncate(field.name, 250),
        value: truncate(field.value, MAX_FIELD_VALUE),
        inline: field.inline ?? false,
      })),
    thumbnail: notification.thumbnailUrl ? { url: notification.thumbnailUrl } : undefined,
    image: notification.imageUrl ? { url: notification.imageUrl } : undefined,
    footer: { text: "lol-watch.com", icon_url: `${SITE_URL}/logo.png` },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 本文にはユーザー投稿のテキストが入るため、@everyone等のメンションは一切解決させない。
      body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`Discord通知に失敗しました (${channel}): HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`Discord通知に失敗しました (${channel}):`, err);
  }
}

// 通報系の通知タイトル用。名前履歴が取れない場合(通常は起きない)でも通知自体は出す。
export function formatRiotId(
  name: { riotIdName: string; riotIdTagLine: string } | undefined,
): string {
  return name ? `${name.riotIdName}#${name.riotIdTagLine}` : "(名前不明のプレイヤー)";
}

// 記事の通知に添える画像。記事詳細ページのOGP画像(opengraph-image.tsx)をそのまま使う。
// 下書きでも生成できる(公開状態を見ていない)ため、Botの下書き通知にも使える。
export function articleCardImageUrl(articleId: string): string {
  return `${SITE_URL}/articles/${articleId}/opengraph-image`;
}
