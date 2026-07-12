// モデレーターアカウントを作成する運用スクリプト。
// 使い方: node scripts/create-moderator.mjs <username> <displayName> <password> [--admin]
// 既存アカウントのパスワードだけ変えずに管理者権限を切り替えたい場合は
// scripts/set-moderator-admin.mjs を使うこと(このスクリプトは実行のたびにパスワードを上書きする)。
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/index.js";

const args = process.argv.slice(2);
const isAdmin = args.includes("--admin");
const [username, displayName, password] = args.filter((a) => a !== "--admin");

if (!username || !displayName || !password) {
  console.error(
    "使い方: node scripts/create-moderator.mjs <username> <displayName> <password> [--admin]",
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
  update: { passwordHash, displayName, isAdmin },
  create: { username, displayName, passwordHash, isAdmin },
});

console.log(
  `モデレーターを作成/更新しました: ${moderator.username} (${moderator.displayName})${moderator.isAdmin ? " [管理者]" : ""}`,
);

await prisma.$disconnect();
