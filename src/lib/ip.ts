import type { NextRequest } from "next/server";

// nginx側でX-Forwarded-For/X-Real-IPを付与している前提(infra/docker/nginx/conf.d)。
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "unknown";
}
