import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  // node-postgresのデフォルト(max: 10)のままだとアクセス集中時に
  // コネクション待ちで詰まりやすいため、余裕を持たせて増やしておく
  // (Postgres側のmax_connectionsは100で、saitama-council-watchと共用のため
  // 増やしすぎないよう注意すること)。
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 20 });
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
