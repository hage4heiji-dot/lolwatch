import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE_URL = "https://lol-watch.com";
// DB内容を反映するため、ビルド時の静的プリレンダー対象から外す
// (プリレンダーしようとするとビルド時点でDB接続が必要になり失敗する。/reportsと同じ方針)。
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 通報のあるプレイヤーページを検索エンジンに拾わせる。
  // 単一sitemapの上限(5万URL)を超えないよう念のため上限を設ける
  // (超える規模になったらgenerateSitemapsでの分割を検討する)。
  const reportedPlayers = await prisma.player.findMany({
    where: { reports: { some: { hiddenAt: null } } },
    select: {
      puuid: true,
      reports: {
        where: { hiddenAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    take: 45000,
  });

  const playerEntries: MetadataRoute.Sitemap = reportedPlayers.map((player) => ({
    url: `${BASE_URL}/players/${player.puuid}`,
    lastModified: player.reports[0]?.createdAt ?? now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE_URL}/reports`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/players`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/stats`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/calibration`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/game`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/guidelines`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/report`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    ...playerEntries,
  ];
}
