import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["160.251.181.152"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ddragon.leagueoflegends.com",
        pathname: "/cdn/**",
      },
    ],
  },
};

export default nextConfig;
