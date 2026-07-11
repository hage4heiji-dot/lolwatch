// 通報のあるプレイヤーについて、直近ランクマッチに出場しているかを定期チェックするバッチ。
// 「通報がちゃんと機能していれば、ランク参加できなくなっているはず」という前提の監視用。
// 実行: npx tsx scripts/check-rank-activity.ts
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hasRecentRankedMatch, RiotApiError } from "../src/lib/riot";

const WINDOW_DAYS = Number(process.env.RANK_CHECK_WINDOW_DAYS ?? "3");
const MIN_INTERVAL_MS = Number(process.env.RIOT_API_MIN_INTERVAL_MS ?? "1300");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const players = await prisma.player.findMany({
    where: { reports: { some: {} } },
    select: { id: true, puuid: true },
  });

  console.log(
    `対象プレイヤー: ${players.length}件 / 直近${WINDOW_DAYS}日間のランク参加を確認します`,
  );

  let activeCount = 0;
  let errorCount = 0;

  for (const player of players) {
    try {
      const isActive = await hasRecentRankedMatch(player.puuid, since);
      await prisma.rankActivityCheck.create({
        data: { playerId: player.id, isActiveInRanked: isActive },
      });
      if (isActive) activeCount += 1;
    } catch (err) {
      errorCount += 1;
      if (err instanceof RiotApiError && err.status === 429) {
        console.warn(`レート制限を検知。5秒待機して次のプレイヤーへ進みます (puuid=${player.puuid})`);
        await sleep(5000);
      } else {
        console.error(`チェック失敗 (puuid=${player.puuid}):`, err);
      }
    }
    await sleep(MIN_INTERVAL_MS);
  }

  console.log(
    `完了: ${players.length}件中 ${activeCount}件がランク参加中、${errorCount}件でエラー`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
