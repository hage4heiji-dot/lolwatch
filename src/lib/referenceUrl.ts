// リプレイに映らないチャット等の証跡として、通報者が任意で添付する参考URL。
// href としてそのまま描画するため、フィッシング等の踏み台にされないよう
// 実際に証跡として使われる主要ドメインのみ許可する(任意のURLは受け付けない)。
export const REFERENCE_URL_MAX_LENGTH = 500;

const ALLOWED_REFERENCE_URL_DOMAINS = [
  "twitch.tv",
  "youtube.com",
  "youtu.be",
  "imgur.com",
  "x.com",
  "twitter.com",
  "twimg.com",
  "discordapp.com",
  "discordapp.net",
  "nicovideo.jp",
  "gyazo.com",
];

export const REFERENCE_URL_ALLOWED_DOMAINS_LABEL =
  "Twitch/YouTube/imgur/X(Twitter)/Discord/ニコニコ動画/Gyazo";

export function isSafeReferenceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();
    return ALLOWED_REFERENCE_URL_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}
