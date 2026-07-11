import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";

export const DEVICE_ID_COOKIE = "lw_device_id";

export function readDeviceId(request: NextRequest): string | null {
  return request.cookies.get(DEVICE_ID_COOKIE)?.value ?? null;
}

export function generateDeviceId(): string {
  return randomUUID();
}

export const DEVICE_ID_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365 * 2,
  path: "/",
};
