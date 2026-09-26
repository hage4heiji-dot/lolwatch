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

export type DiscordNotification = {
  title: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: { name: string; value: string }[];
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export async function notifyDiscord(
  channel: DiscordChannel,
  notification: DiscordNotification,
): Promise<void> {
  const webhookUrl = WEBHOOK_URLS[channel];
  if (!webhookUrl) return;

  const embed = {
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
      })),
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
