import { randomUUID } from "node:crypto";
import type { WebSocket, WebSocketServer } from "ws";
import {
  BEAT_MS,
  BPM,
  COMBO_BONUS_CAP,
  GAME_DURATION_MS,
  MAX_PLAYERS,
  TARGET_TTL_MS,
} from "../lib/gameProtocol";
import type {
  ClientMessage,
  Judgment,
  PlayerState,
  RoomSnapshot,
  ServerMessage,
  Target,
  TargetType,
} from "../lib/gameProtocol";

const TICK_MS = 50;
// 0/O, 1/I など見間違えやすい文字を除いた部屋コード用文字集合。
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type Player = {
  id: string;
  name: string;
  ws: WebSocket;
  score: number;
  combo: number;
  maxCombo: number;
  hits: number;
  misses: number;
  perfects: number;
  goods: number;
  connected: boolean;
};

type RoomStatus = "lobby" | "playing" | "finished";

type Room = {
  code: string;
  hostId: string;
  status: RoomStatus;
  players: Map<string, Player>;
  targets: Target[];
  targetIdCounter: number;
  startedAt: number;
  lastSpawnBeat: number;
  intervalHandle: ReturnType<typeof setInterval> | null;
};

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    let code = "";
    for (let i = 0; i < 4; i += 1) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error("部屋コードの生成に失敗しました");
}

function progressOf(elapsedMs: number) {
  return Math.min(elapsedMs / GAME_DURATION_MS, 1);
}

function speedFor(elapsedMs: number) {
  return 16 + progressOf(elapsedMs) * 24;
}

function concurrencyFor(elapsedMs: number, playerCount: number) {
  const base = 3 + progressOf(elapsedMs) * 4;
  return Math.round(base + Math.max(0, playerCount - 1) * 1.5);
}

// ビートに乗って1〜2体まとまって出現させる(後半ほど2体同時の確率が上がる)。
function spawnCountForBeat(elapsedMs: number, playerCount: number) {
  const p = progressOf(elapsedMs);
  const extraChance = 0.2 + p * 0.5 + Math.max(0, playerCount - 1) * 0.08;
  return Math.random() < extraChance ? 2 : 1;
}

function createTarget(id: number, elapsedMs: number, now: number): Target {
  const type: TargetType = Math.random() < 0.78 ? "troll" : "sport";
  const speed = speedFor(elapsedMs);
  const angle = Math.random() * Math.PI * 2;
  return {
    id,
    type,
    x: 12 + Math.random() * 76,
    y: 12 + Math.random() * 76,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    bornAt: now,
  };
}

function stepTarget(target: Target, dtMs: number): Target {
  const dt = dtMs / 1000;
  const margin = 8;
  let x = target.x + target.vx * dt;
  let y = target.y + target.vy * dt;
  let vx = target.vx;
  let vy = target.vy;

  if (x < margin) {
    x = margin;
    vx = Math.abs(vx);
  } else if (x > 100 - margin) {
    x = 100 - margin;
    vx = -Math.abs(vx);
  }
  if (y < margin) {
    y = margin;
    vy = Math.abs(vy);
  } else if (y > 100 - margin) {
    y = 100 - margin;
    vy = -Math.abs(vy);
  }

  return { ...target, x, y, vx, vy };
}

function judgmentFor(offsetMs: number): Judgment {
  if (offsetMs <= 90) return "perfect";
  if (offsetMs <= 180) return "good";
  return "miss";
}

function toPlayerState(p: Player): PlayerState {
  return {
    id: p.id,
    name: p.name,
    score: p.score,
    combo: p.combo,
    maxCombo: p.maxCombo,
    hits: p.hits,
    misses: p.misses,
    perfects: p.perfects,
    goods: p.goods,
    connected: p.connected,
  };
}

function snapshot(room: Room, elapsed: number): RoomSnapshot {
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    players: [...room.players.values()].map(toPlayerState),
    targets: room.targets,
    remainingMs: room.status === "playing" ? Math.max(0, GAME_DURATION_MS - elapsed) : GAME_DURATION_MS,
    beatIndex: room.status === "playing" ? Math.floor(elapsed / BEAT_MS) : 0,
    bpm: BPM,
  };
}

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function broadcast(room: Room, message: ServerMessage) {
  for (const player of room.players.values()) {
    send(player.ws, message);
  }
}

function currentElapsed(room: Room) {
  return room.status === "playing" ? Date.now() - room.startedAt : 0;
}

function broadcastRoom(room: Room) {
  broadcast(room, { type: "room", room: snapshot(room, currentElapsed(room)) });
}

function stopRoomLoop(room: Room) {
  if (room.intervalHandle) {
    clearInterval(room.intervalHandle);
    room.intervalHandle = null;
  }
}

function endGame(room: Room) {
  stopRoomLoop(room);
  room.status = "finished";
  broadcast(room, { type: "gameOver", room: snapshot(room, GAME_DURATION_MS) });
}

function tickRoom(room: Room) {
  const now = Date.now();
  const elapsed = now - room.startedAt;
  if (elapsed >= GAME_DURATION_MS) {
    endGame(room);
    return;
  }

  let next = room.targets.map((t) => stepTarget(t, TICK_MS)).filter((t) => now - t.bornAt < TARGET_TTL_MS);

  const beatIndex = Math.floor(elapsed / BEAT_MS);
  if (beatIndex > room.lastSpawnBeat) {
    room.lastSpawnBeat = beatIndex;
    const maxConcurrent = concurrencyFor(elapsed, room.players.size);
    const spawnCount = Math.max(0, Math.min(spawnCountForBeat(elapsed, room.players.size), maxConcurrent - next.length));
    for (let i = 0; i < spawnCount; i += 1) {
      room.targetIdCounter += 1;
      next = [...next, createTarget(room.targetIdCounter, elapsed, now)];
    }
  }

  room.targets = next;
  broadcastRoom(room);
}

function startRoom(room: Room) {
  if (room.status === "playing") return;
  for (const p of room.players.values()) {
    p.score = 0;
    p.combo = 0;
    p.maxCombo = 0;
    p.hits = 0;
    p.misses = 0;
    p.perfects = 0;
    p.goods = 0;
  }
  room.targets = [];
  room.targetIdCounter = 0;
  room.lastSpawnBeat = -1;
  room.startedAt = Date.now();
  room.status = "playing";
  stopRoomLoop(room);
  room.intervalHandle = setInterval(() => tickRoom(room), TICK_MS);
  broadcastRoom(room);
}

function handleHit(room: Room, player: Player, targetId: number) {
  if (room.status !== "playing") return;
  const idx = room.targets.findIndex((t) => t.id === targetId);
  if (idx === -1) return;

  const target = room.targets[idx];
  room.targets = [...room.targets.slice(0, idx), ...room.targets.slice(idx + 1)];

  const elapsed = currentElapsed(room);
  const sinceBeat = elapsed % BEAT_MS;
  const beatOffset = Math.min(sinceBeat, BEAT_MS - sinceBeat);
  const judgment = judgmentFor(beatOffset);

  let points: number;
  let resultJudgment: Judgment;

  if (target.type === "troll") {
    player.combo += 1;
    player.maxCombo = Math.max(player.maxCombo, player.combo);
    const base = 10 + Math.min(player.combo - 1, COMBO_BONUS_CAP) * 2;
    const multiplier = judgment === "perfect" ? 1.5 : judgment === "good" ? 1.15 : 1;
    points = Math.round(base * multiplier);
    player.score += points;
    player.hits += 1;
    if (judgment === "perfect") player.perfects += 1;
    if (judgment === "good") player.goods += 1;
    resultJudgment = judgment;
  } else {
    player.combo = 0;
    points = -15;
    player.score = Math.max(0, player.score + points);
    player.misses += 1;
    resultJudgment = "miss";
  }

  broadcast(room, {
    type: "hitResult",
    playerId: player.id,
    playerName: player.name,
    targetId: target.id,
    targetType: target.type,
    judgment: resultJudgment,
    points,
    combo: player.combo,
    x: target.x,
    y: target.y,
  });
  broadcastRoom(room);
}

function handleMissClick(room: Room, player: Player) {
  if (room.status !== "playing") return;
  if (player.combo > 0) {
    player.combo = 0;
    broadcastRoom(room);
  }
}

function createPlayer(ws: WebSocket, rawName: string): Player {
  const name = rawName.trim().slice(0, 16) || "プレイヤー";
  return {
    id: randomUUID(),
    name,
    ws,
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    misses: 0,
    perfects: 0,
    goods: 0,
    connected: true,
  };
}

function createRoom(host: Player): Room {
  const code = generateRoomCode();
  const room: Room = {
    code,
    hostId: host.id,
    status: "lobby",
    players: new Map([[host.id, host]]),
    targets: [],
    targetIdCounter: 0,
    startedAt: 0,
    lastSpawnBeat: -1,
    intervalHandle: null,
  };
  rooms.set(code, room);
  return room;
}

export function attachGameServer(wss: WebSocketServer) {
  wss.on("connection", (ws) => {
    let player: Player | null = null;
    let room: Room | null = null;

    ws.on("message", (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === "create") {
        if (room) return;
        player = createPlayer(ws, msg.name);
        room = createRoom(player);
        send(ws, { type: "joined", playerId: player.id, room: snapshot(room, 0) });
        return;
      }

      if (msg.type === "join") {
        if (room) return;
        const target = rooms.get(msg.code.trim().toUpperCase());
        if (!target) {
          send(ws, { type: "errorMsg", message: "部屋が見つかりませんでした。コードを確認してください。" });
          return;
        }
        if (target.status === "playing") {
          send(ws, { type: "errorMsg", message: "このゲームはすでに開始されています。" });
          return;
        }
        if (target.players.size >= MAX_PLAYERS) {
          send(ws, { type: "errorMsg", message: "この部屋は満員です(最大4人)。" });
          return;
        }
        player = createPlayer(ws, msg.name);
        room = target;
        room.players.set(player.id, player);
        send(ws, { type: "joined", playerId: player.id, room: snapshot(room, 0) });
        broadcastRoom(room);
        return;
      }

      if (!room || !player) return;

      if (msg.type === "start") {
        if (player.id !== room.hostId) return;
        startRoom(room);
        return;
      }

      if (msg.type === "hit") {
        handleHit(room, player, msg.targetId);
        return;
      }

      if (msg.type === "missClick") {
        handleMissClick(room, player);
        return;
      }
    });

    ws.on("close", () => {
      if (!room || !player) return;
      const closedRoom = room;
      const closedPlayer = player;

      closedRoom.players.delete(closedPlayer.id);

      if (closedRoom.players.size === 0) {
        stopRoomLoop(closedRoom);
        rooms.delete(closedRoom.code);
        return;
      }

      if (closedPlayer.id === closedRoom.hostId) {
        const nextHost = closedRoom.players.values().next().value;
        if (nextHost) closedRoom.hostId = nextHost.id;
      }

      broadcastRoom(closedRoom);
    });
  });
}
