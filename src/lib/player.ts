import { prisma } from "@/lib/prisma";
import type { RiotAccount } from "@/lib/riot";

// PUUIDは改名しても変わらないため、これをキーにPlayerを一意に特定する。
// 表示名が変わっていた場合はPlayerNameHistoryに新しい行を追加し、旧名はisCurrent=falseにする。
export async function upsertPlayerFromRiotAccount(
  account: RiotAccount,
  platform: string,
) {
  const player = await prisma.player.upsert({
    where: { puuid: account.puuid },
    update: {},
    create: { puuid: account.puuid, platform },
  });

  const currentName = await prisma.playerNameHistory.findFirst({
    where: { playerId: player.id, isCurrent: true },
  });

  const nameChanged =
    !currentName ||
    currentName.riotIdName !== account.gameName ||
    currentName.riotIdTagLine !== account.tagLine;

  if (nameChanged) {
    await prisma.$transaction([
      prisma.playerNameHistory.updateMany({
        where: { playerId: player.id, isCurrent: true },
        data: { isCurrent: false },
      }),
      prisma.playerNameHistory.upsert({
        where: {
          playerId_riotIdName_riotIdTagLine: {
            playerId: player.id,
            riotIdName: account.gameName,
            riotIdTagLine: account.tagLine,
          },
        },
        update: { isCurrent: true, lastSeenAt: new Date() },
        create: {
          playerId: player.id,
          riotIdName: account.gameName,
          riotIdTagLine: account.tagLine,
          isCurrent: true,
        },
      }),
    ]);
  } else if (currentName) {
    await prisma.playerNameHistory.update({
      where: { id: currentName.id },
      data: { lastSeenAt: new Date() },
    });
  }

  return player;
}
