// 既存モデレーターの管理者権限だけをパスワードを変えずに切り替える運用スクリプト。
// 使い方: node scripts/set-moderator-admin.mjs <username> <true|false>
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/index.js";

const [username, flag] = process.argv.slice(2);

if (!username || (flag !== "true" && flag !== "false")) {
  console.error("使い方: node scripts/set-moderator-admin.mjs <username> <true|false>");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const moderator = await prisma.moderator.update({
  where: { username },
  data: { isAdmin: flag === "true" },
});

console.log(
  `${moderator.username} (${moderator.displayName}) の管理者権限を ${moderator.isAdmin ? "付与" : "解除"} しました。`,
);

await prisma.$disconnect();
