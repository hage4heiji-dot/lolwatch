// 通報のあるプレイヤーについて、直近ランクマッチに出場しているかを定期チェックするバッチ。
// 「通報がちゃんと機能していれば、ランク参加できなくなっているはず」という前提の監視用。
// 実行: npx tsx scripts/check-rank-activity.ts
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hasRecentRankedMatch, RiotApiError } from "../src/lib/riot";
import { DISCORD_COLORS, discordCodeBlock, notifyDiscord } from "../src/lib/discord";

const WINDOW_DAYS = Number(process.env.RANK_CHECK_WINDOW_DAYS ?? "3");
const MIN_INTERVAL_MS = Number(process.env.RIOT_API_MIN_INTERVAL_MS ?? "1300");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const players = await prisma.player.findMany({
    where: { reports: { some: {} } },
    select: {
      id: true,
      puuid: true,
      // 「通報後にランクへ参加しているか」の起点。非表示の通報(誤通報等)は起点にしない。
      reports: {
        where: { hiddenAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  console.log(
    `対象プレイヤー: ${players.length}件 / 直近${WINDOW_DAYS}日間のランク参加を確認します`,
  );

  let activeCount = 0;
  let notSinceReportCount = 0;
  let errorCount = 0;

  for (const player of players) {
    try {
      const isActive = await hasRecentRankedMatch(player.puuid, since);

      const latestReportAt = player.reports[0]?.createdAt ?? null;
      let hasRankedSinceReport: boolean | null = null;
      if (latestReportAt) {
        if (isActive && latestReportAt <= since) {
          // 直近の出場が通報より後なのは明らかなので、追加のAPI呼び出しを省く。
          hasRankedSinceReport = true;
        } else {
          await sleep(MIN_INTERVAL_MS);
          hasRankedSinceReport = await hasRecentRankedMatch(player.puuid, latestReportAt);
        }
      }

      await prisma.rankActivityCheck.create({
        data: {
          playerId: player.id,
          isActiveInRanked: isActive,
          sinceReportAt: latestReportAt,
          hasRankedSinceReport,
        },
      });
      if (isActive) activeCount += 1;
      if (hasRankedSinceReport === false) notSinceReportCount += 1;
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
    `完了: ${players.length}件中 ${activeCount}件がランク参加中、${notSinceReportCount}件が通報後ランク未参加、${errorCount}件でエラー`,
  );
  await notifyDiscord("batch", {
    label: errorCount > 0 ? "⚠️ 一部エラー" : "✅ 完了",
    title: "ランク参加チェック",
    color: errorCount > 0 ? DISCORD_COLORS.yellow : DISCORD_COLORS.green,
    fields: [
      { name: "対象", value: `${players.length}人`, inline: true },
      { name: "ランク参加中", value: `${activeCount}人`, inline: true },
      { name: "通報後ランク未参加", value: `${notSinceReportCount}人`, inline: true },
      { name: "エラー", value: `${errorCount}件`, inline: true },
    ],
  });
}

main()
  .catch(async (err) => {
    console.error(err);
    process.exitCode = 1;
    await notifyDiscord("batch", {
      label: "❌ 失敗",
      title: "ランク参加チェック",
      color: DISCORD_COLORS.red,
      description: discordCodeBlock(err instanceof Error ? (err.stack ?? err.message) : String(err)),
    });
  })
  .finally(() => prisma.$disconnect());
