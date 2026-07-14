import type { MetadataRoute } from "next";

const BASE_URL = "https://lol-watch.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE_URL}/reports`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/players`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/stats`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/guidelines`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/report`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
