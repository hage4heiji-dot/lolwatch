import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // モデレータ専用ページはログイン必須で公開コンテンツを持たないため、
      // クロールバジェットの無駄遣いを避ける。
      disallow: ["/moderator", "/api"],
    },
    sitemap: "https://lol-watch.com/sitemap.xml",
  };
}
