import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "lw_mod_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type LoginResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

export async function attemptLogin(
  username: string,
  password: string,
): Promise<LoginResult> {
  const moderator = await prisma.moderator.findUnique({ where: { username } });
  // ユーザー存在有無で応答を変えない(列挙攻撃対策)ため、常に同じエラーメッセージを返す。
  const genericError = "ユーザー名またはパスワードが正しくありません。";

  if (!moderator) {
    await bcrypt.compare(password, "$2a$12$invalidsaltinvalidsaltinvalidsal.");
    return { ok: false, error: genericError };
  }

  if (moderator.lockedUntil && moderator.lockedUntil > new Date()) {
    return {
      ok: false,
      error: "ログイン試行回数が上限に達しました。しばらくしてから再度お試しください。",
    };
  }

  const valid = await bcrypt.compare(password, moderator.passwordHash);
  if (!valid) {
    const attempts = moderator.failedLoginAttempts + 1;
    await prisma.moderator.update({
      where: { id: moderator.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil:
          attempts >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MS)
            : null,
      },
    });
    return { ok: false, error: genericError };
  }

  await prisma.moderator.update({
    where: { id: moderator.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  const token = randomBytes(32).toString("hex");
  await prisma.moderatorSession.create({
    data: {
      moderatorId: moderator.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  return { ok: true, token };
}

export async function destroySessionByToken(token: string): Promise<void> {
  await prisma.moderatorSession.deleteMany({
    where: { tokenHash: hashToken(token) },
  });
}

export async function getSessionModerator() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.moderatorSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { moderator: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.moderator;
}

export async function requireModerator() {
  const moderator = await getSessionModerator();
  if (!moderator) {
    redirect("/moderator/login");
  }
  return moderator;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_TTL_MS / 1000,
  path: "/",
};
