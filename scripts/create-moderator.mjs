// モデレーターアカウントを作成する運用スクリプト。
// 使い方: node scripts/create-moderator.mjs <username> <displayName> <password>
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/index.js";

const [username, displayName, password] = process.argv.slice(2);

if (!username || !displayName || !password) {
  console.error(
    "使い方: node scripts/create-moderator.mjs <username> <displayName> <password>",
  );
  process.exit(1);
}

if (password.length < 12) {
  console.error("パスワードは12文字以上にしてください。");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const passwordHash = await bcrypt.hash(password, 12);

const moderator = await prisma.moderator.upsert({
  where: { username },
  update: { passwordHash, displayName },
  create: { username, displayName, passwordHash },
});

console.log(`モデレーターを作成/更新しました: ${moderator.username} (${moderator.displayName})`);

await prisma.$disconnect();
