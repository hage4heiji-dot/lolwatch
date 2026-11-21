// Google Search Console (Search Analytics API) から検索キーワード等を取得するヘルパー。
// 認証はGA4と同じサービスアカウント(GOOGLE_APPLICATION_CREDENTIALS)を使う。
// 事前準備:
//   1. GCPプロジェクトで「Google Search Console API」を有効化する
//   2. Search Consoleのプロパティ設定 → ユーザーと権限 で、サービスアカウントの
//      メールアドレスを「制限付き」以上の権限で追加する
// 対象プロパティは SEARCH_CONSOLE_SITE_URL ("sc-domain:lol-watch.com" や
// "https://lol-watch.com/") で指定する。未設定ならアクセス可能なプロパティから
// lol-watch.com を含むものを自動で選ぶ。
import { GoogleAuth } from "google-auth-library";

const API_BASE = "https://www.googleapis.com/webmasters/v3";
const SITE_HOST = "lol-watch.com";

export type SearchDimension = "query" | "page" | "country" | "device" | "date" | "hour";

export type SearchAnalyticsRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchAnalyticsRequest = {
  startDate: string; // YYYY-MM-DD (Search Consoleは太平洋時間基準)
  endDate: string;
  dimensions: SearchDimension[];
  rowLimit?: number;
  // "all" は確定前の速報値も含む。hourディメンションを使う場合は "hourly_all" が必須。
  dataState?: "final" | "all" | "hourly_all";
  orderByImpressions?: boolean;
};

let authClient: Awaited<ReturnType<GoogleAuth["getClient"]>> | undefined;
let resolvedSiteUrl: string | undefined;

async function getClient() {
  if (!authClient) {
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    authClient = await auth.getClient();
  }
  return authClient;
}

export async function getSearchConsoleSiteUrl(): Promise<string> {
  if (resolvedSiteUrl) return resolvedSiteUrl;
  const fromEnv = process.env.SEARCH_CONSOLE_SITE_URL;
  if (fromEnv) return (resolvedSiteUrl = fromEnv);

  const client = await getClient();
  const res = await client.request<{ siteEntry?: { siteUrl: string }[] }>({
    url: `${API_BASE}/sites`,
  });
  const sites = (res.data.siteEntry ?? []).map((s) => s.siteUrl);
  // ドメインプロパティの方が http/https・サブドメインをまとめて集計できるので優先する。
  const found =
    sites.find((s) => s === `sc-domain:${SITE_HOST}`) ?? sites.find((s) => s.includes(SITE_HOST));
  if (!found) {
    throw new Error(
      `Search Consoleで ${SITE_HOST} のプロパティにアクセスできません(見えるプロパティ: ${
        sites.join(", ") || "なし"
      })。サービスアカウントをプロパティのユーザーに追加してください。`,
    );
  }
  return (resolvedSiteUrl = found);
}

export async function querySearchAnalytics(
  req: SearchAnalyticsRequest,
): Promise<SearchAnalyticsRow[]> {
  const client = await getClient();
  const siteUrl = await getSearchConsoleSiteUrl();
  const res = await client.request<{ rows?: SearchAnalyticsRow[] }>({
    url: `${API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    method: "POST",
    data: {
      startDate: req.startDate,
      endDate: req.endDate,
      dimensions: req.dimensions,
      rowLimit: req.rowLimit ?? 25,
      dataState: req.dataState ?? "all",
    },
  });
  const rows = res.data.rows ?? [];
  // APIはクリック数順で返す。表示回数で見たい場合だけ並べ替える。
  if (req.orderByImpressions) rows.sort((a, b) => b.impressions - a.impressions);
  return rows;
}
