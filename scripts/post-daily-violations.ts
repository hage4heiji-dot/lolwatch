// 前日(JST)にモデレーターが「違反確認」と判定した通報をユーザー単位で集計し、
// Xへ日次まとめとして投稿するバッチ。未検証の通報件数ではなく、実際に確認された
// 違反のみを対象にする(weaponizeされた大量通報の拡散を避けるため)。
// X認証情報が未設定の場合はpostToXが何もしないため、このスクリプト自体は
// 常に安全に実行できる。
// 実行: npx tsx scripts/post-daily-violations.ts
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { todayJstMidnightUtc, toJstDateKey } from "../src/lib/jstDate";
import { buildDailyViolationDigest, isXPostConfigured, postToX } from "../src/lib/xPost";

async function main() {
  const until = todayJstMidnightUtc();
  const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);
  const dateLabel = toJstDateKey(since);

  if (!isXPostConfigured) {
    console.log("X投稿は未設定のためスキップします。");
    return;
  }

  // 「違反確認」となった通報を対象に、プレイヤーごとの最新レビューを取得する。
  // 最新レビューがVIOLATION_CONFIRMEDかつ、その判定が対象期間内に行われた場合のみ集計する
  // (その後の再審査で判定が覆っている場合は対象から除く)。
  const reports = await prisma.report.findMany({
    where: {
      hiddenAt: null,
      moderatorReviews: { some: { createdAt: { gte: since, lt: until }, verdict: "VIOLATION_CONFIRMED" } },
    },
    select: {
      playerId: true,
      player: {
        select: { nameHistory: { where: { isCurrent: true }, take: 1 } },
      },
      moderatorReviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { verdict: true, createdAt: true },
      },
    },
  });

  const countByPlayerId = new Map<string, { riotId: string; count: number }>();
  for (const report of reports) {
    const latest = report.moderatorReviews[0];
    if (!latest || latest.verdict !== "VIOLATION_CONFIRMED") continue;
    if (latest.createdAt < since || latest.createdAt >= until) continue;

    const name = report.player.nameHistory[0];
    const riotId = name ? `${name.riotIdName} #${name.riotIdTagLine}` : report.playerId;
    const entry = countByPlayerId.get(report.playerId) ?? { riotId, count: 0 };
    entry.count += 1;
    countByPlayerId.set(report.playerId, entry);
  }

  const entries = Array.from(countByPlayerId.values()).sort((a, b) => b.count - a.count);

  const text = buildDailyViolationDigest({ dateLabel, entries });
  await postToX(text);

  if (entries.length === 0) {
    console.log(`${dateLabel}: 違反確認されたユーザーはいませんでした。自己紹介を投稿しました。`);
  } else {
    console.log(`${dateLabel}: ${entries.length}人分の日次まとめを投稿しました。`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
