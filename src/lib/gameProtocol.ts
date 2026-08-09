export const BPM = 128;
export const BEAT_MS = 60000 / BPM;
export const GAME_DURATION_MS = 40000;
export const MAX_PLAYERS = 4;
export const TARGET_TTL_MS = 3400;
export const COMBO_BONUS_CAP = 20;

export type TargetType = "troll" | "sport";

export type Target = {
  id: number;
  type: TargetType;
  x: number; // % of stage width
  y: number; // % of stage height
  vx: number; // %/s
  vy: number; // %/s
  bornAt: number; // epoch ms (Date.now())
};

export type Judgment = "perfect" | "good" | "miss";

export type PlayerState = {
  id: string;
  name: string;
  score: number;
  combo: number;
  maxCombo: number;
  hits: number;
  misses: number;
  perfects: number;
  goods: number;
  connected: boolean;
};

export type RoomStatus = "lobby" | "playing" | "finished";

export type RoomSnapshot = {
  code: string;
  status: RoomStatus;
  hostId: string;
  players: PlayerState[];
  targets: Target[];
  remainingMs: number;
  beatIndex: number;
  bpm: number;
};

export type ClientMessage =
  | { type: "create"; name: string }
  | { type: "join"; code: string; name: string }
  | { type: "start" }
  | { type: "hit"; targetId: number }
  | { type: "missClick" };

export type HitResultMessage = {
  type: "hitResult";
  playerId: string;
  playerName: string;
  targetId: number;
  targetType: TargetType;
  judgment: Judgment;
  points: number;
  combo: number;
  x: number;
  y: number;
};

export type ServerMessage =
  | { type: "joined"; playerId: string; room: RoomSnapshot }
  | { type: "room"; room: RoomSnapshot }
  | HitResultMessage
  | { type: "gameOver"; room: RoomSnapshot }
  | { type: "errorMsg"; message: string };
