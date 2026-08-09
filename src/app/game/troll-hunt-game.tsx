"use client";

import { useEffect, useRef, useState } from "react";
import {
  GAME_DURATION_MS,
  MAX_PLAYERS,
  type ClientMessage,
  type HitResultMessage,
  type PlayerState,
  type RoomSnapshot,
  type ServerMessage,
  type Target,
} from "@/lib/gameProtocol";

const NAME_STORAGE_KEY = "lolwatch-troll-game-name";
const BEST_SCORE_KEY = "lolwatch-troll-game-best";

type FloatText = {
  id: number;
  x: number;
  y: number;
  text: string;
  sub: string;
  kind: "perfect" | "good" | "miss" | "penalty";
};

function readInitialName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_STORAGE_KEY) ?? "";
}

function readInitialJoinCode(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "";
}

function readInitialBest(): number | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(BEST_SCORE_KEY);
  return stored ? Number(stored) : null;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  durationSec: number,
  { type = "sine", gain = 0.16, delaySec = 0 }: { type?: OscillatorType; gain?: number; delaySec?: number } = {},
) {
  const startAt = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gainNode.gain.setValueAtTime(gain, startAt);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startAt + durationSec);
  osc.connect(gainNode).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + durationSec);
}

// 陽気なマリンバ風の8音ループ(ド・ミ・ソ・ミ・レ・ソ・ラ・ソ)。ビートごとに1音ずつ鳴らす。
const MELODY_PATTERN = [523.25, 659.25, 783.99, 659.25, 587.33, 783.99, 880.0, 783.99];

function playBeatSound(ctx: AudioContext, beatIndex: number) {
  const note = MELODY_PATTERN[beatIndex % MELODY_PATTERN.length];
  playTone(ctx, note, 0.17, { type: "triangle", gain: 0.1 });
  if (beatIndex % 4 === 0) {
    playTone(ctx, 110, 0.14, { type: "sine", gain: 0.13 });
  }
}

function playJudgmentSound(ctx: AudioContext, judgment: HitResultMessage["judgment"]) {
  if (judgment === "perfect") {
    playTone(ctx, 1046.5, 0.1, { type: "triangle", gain: 0.22 });
    playTone(ctx, 1318.5, 0.16, { type: "triangle", gain: 0.2, delaySec: 0.05 });
  } else if (judgment === "good") {
    playTone(ctx, 783.99, 0.14, { type: "triangle", gain: 0.19 });
  } else {
    playTone(ctx, 440, 0.12, { type: "triangle", gain: 0.15 });
  }
}

function playPenaltySound(ctx: AudioContext) {
  // ずっこけ効果音風の下降ブザー。
  playTone(ctx, 220, 0.14, { type: "sawtooth", gain: 0.17 });
  playTone(ctx, 155, 0.22, { type: "sawtooth", gain: 0.15, delaySec: 0.09 });
}

function playGameOverSound(ctx: AudioContext) {
  [523, 659, 784, 1046].forEach((freq, i) => {
    playTone(ctx, freq, 0.18, { gain: 0.14, delaySec: i * 0.09 });
  });
}

export function TrollHuntGame() {
  const [name, setName] = useState<string>(readInitialName);
  const [joinCode, setJoinCode] = useState<string>(readInitialJoinCode);
  const [connStatus, setConnStatus] = useState<"idle" | "connecting" | "open" | "closed">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [floatTexts, setFloatTexts] = useState<FloatText[]>([]);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [beatPulseToken, setBeatPulseToken] = useState(0);
  const [best, setBest] = useState<number | null>(readInitialBest);
  const [isNewBest, setIsNewBest] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastBeatIndexRef = useRef(-1);
  const floatIdRef = useRef(0);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  function ensureAudio(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      const AudioCtx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch {
      // 音声初期化に失敗してもゲーム進行はブロックしない
      return null;
    }
  }

  function addFloatText(x: number, y: number, text: string, sub: string, kind: FloatText["kind"]) {
    floatIdRef.current += 1;
    const id = floatIdRef.current;
    setFloatTexts((prev) => [...prev, { id, x, y, text, sub, kind }]);
    setTimeout(() => {
      setFloatTexts((prev) => prev.filter((f) => f.id !== id));
    }, 750);
  }

  function handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "joined": {
        setPlayerId(msg.playerId);
        setRoom(msg.room);
        lastBeatIndexRef.current = msg.room.beatIndex;
        break;
      }
      case "room": {
        if (msg.room.status === "playing" && msg.room.beatIndex !== lastBeatIndexRef.current) {
          lastBeatIndexRef.current = msg.room.beatIndex;
          setBeatPulseToken((t) => t + 1);
          const ctx = audioCtxRef.current;
          if (ctx) playBeatSound(ctx, msg.room.beatIndex);
        }
        setRoom(msg.room);
        break;
      }
      case "hitResult": {
        const ctx = audioCtxRef.current;
        if (msg.targetType === "sport") {
          if (ctx) playPenaltySound(ctx);
          addFloatText(msg.x, msg.y, `${msg.points}`, `${msg.playerName} あちゃー`, "penalty");
        } else {
          if (ctx) playJudgmentSound(ctx, msg.judgment);
          const label = msg.judgment === "perfect" ? "ちょうどいい!" : msg.judgment === "good" ? "おしい!" : "うーん";
          addFloatText(msg.x, msg.y, `+${msg.points}`, `${msg.playerName} ${label}`, msg.judgment);
        }
        break;
      }
      case "gameOver": {
        setRoom(msg.room);
        const ctx = audioCtxRef.current;
        if (ctx) playGameOverSound(ctx);
        const mine = msg.room.players.find((p) => p.id === playerId);
        if (mine) {
          setBest((prevBest) => {
            if (prevBest === null || mine.score > prevBest) {
              window.localStorage.setItem(BEST_SCORE_KEY, String(mine.score));
              setIsNewBest(true);
              return mine.score;
            }
            setIsNewBest(false);
            return prevBest;
          });
        }
        break;
      }
      case "errorMsg": {
        setErrorMessage(msg.message);
        break;
      }
    }
  }

  function openSocket(onOpenSend: ClientMessage) {
    setConnStatus("connecting");
    setErrorMessage(null);
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${proto}//${window.location.host}/game-ws`);
    } catch {
      setConnStatus("closed");
      setErrorMessage("接続を開始できませんでした。ページを再読み込みして再度お試しください。");
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      setConnStatus("open");
      ws.send(JSON.stringify(onOpenSend));
    };
    ws.onclose = () => {
      setConnStatus("closed");
    };
    ws.onerror = () => {
      setErrorMessage("接続エラーが発生しました。時間をおいて再度お試しください。");
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        handleServerMessage(msg);
      } catch {
        // 不正なメッセージは無視する
      }
    };
  }

  function sendMessage(msg: ClientMessage) {
    wsRef.current?.send(JSON.stringify(msg));
  }

  function handleCreateRoom() {
    const trimmed = name.trim();
    if (trimmed) window.localStorage.setItem(NAME_STORAGE_KEY, trimmed);
    ensureAudio();
    setIsNewBest(false);
    openSocket({ type: "create", name: trimmed || "プレイヤー" });
  }

  function handleJoinRoom() {
    const trimmed = name.trim();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setErrorMessage("部屋コードを入力してください。");
      return;
    }
    if (trimmed) window.localStorage.setItem(NAME_STORAGE_KEY, trimmed);
    ensureAudio();
    setIsNewBest(false);
    openSocket({ type: "join", code, name: trimmed || "プレイヤー" });
  }

  function handleStart() {
    ensureAudio();
    sendMessage({ type: "start" });
  }

  function handleBackToMenu() {
    wsRef.current?.close();
    wsRef.current = null;
    setRoom(null);
    setPlayerId(null);
    setConnStatus("idle");
    setFloatTexts([]);
  }

  function handleTargetClick(target: Target, e: React.MouseEvent) {
    e.stopPropagation();
    if (room?.status !== "playing") return;
    sendMessage({ type: "hit", targetId: target.id });
  }

  function handleBoardMissClick() {
    if (room?.status !== "playing") return;
    sendMessage({ type: "missClick" });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setPointer({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }

  const isHost = !!room && !!playerId && room.hostId === playerId;
  const me = room?.players.find((p) => p.id === playerId) ?? null;
  const sortedPlayers: PlayerState[] = room ? [...room.players].sort((a, b) => b.score - a.score) : [];
  const remainingSec = room ? Math.ceil(room.remainingMs / 1000) : Math.ceil(GAME_DURATION_MS / 1000);
  const shareUrl =
    room && typeof window !== "undefined" ? `${window.location.origin}/game?room=${room.code}` : "";

  return (
    <div className="troll-game">
      {!room && (
        <div className="troll-game-menu">
          <label className="troll-game-field">
            <span>ニックネーム</span>
            <input
              type="text"
              value={name}
              maxLength={16}
              placeholder="例: サモナー太郎"
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="troll-game-menu-actions">
            <div className="troll-game-menu-card">
              <p className="troll-game-menu-card-title">部屋を作る</p>
              <p className="muted">最大{MAX_PLAYERS}人まで参加できる部屋のホストになります。</p>
              <button type="button" className="btn" onClick={handleCreateRoom} disabled={connStatus === "connecting"}>
                部屋を作る
              </button>
            </div>

            <div className="troll-game-menu-card">
              <p className="troll-game-menu-card-title">部屋に入る</p>
              <p className="muted">友達から共有された部屋コードを入力してください。</p>
              <input
                type="text"
                value={joinCode}
                maxLength={4}
                placeholder="例: 6VB5"
                className="troll-game-code-input"
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleJoinRoom}
                disabled={connStatus === "connecting"}
              >
                部屋に入る
              </button>
            </div>
          </div>

          {best !== null && <p className="muted troll-game-menu-best">自己ベスト: {best}</p>}
          {errorMessage && <p className="error-text">{errorMessage}</p>}
        </div>
      )}

      {room && room.status === "lobby" && (
        <div className="troll-game-lobby">
          <div className="troll-game-room-code">
            <span className="muted">部屋コード</span>
            <span className="troll-game-room-code-value">{room.code}</span>
          </div>
          {shareUrl && (
            <div className="troll-game-share-row">
              <input type="text" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigator.clipboard?.writeText(shareUrl).catch(() => {})}
              >
                コピー
              </button>
            </div>
          )}

          <ul className="troll-game-player-list">
            {room.players.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                {p.id === room.hostId && <span className="troll-game-host-badge">ホスト</span>}
                {p.id === playerId && <span className="muted">(あなた)</span>}
              </li>
            ))}
            {Array.from({ length: Math.max(0, MAX_PLAYERS - room.players.length) }).map((_, i) => (
              <li key={`empty-${i}`} className="muted">
                参加者待ち…
              </li>
            ))}
          </ul>

          {isHost ? (
            <button type="button" className="btn" onClick={handleStart}>
              ゲーム開始
            </button>
          ) : (
            <p className="muted">ホストの開始を待っています…</p>
          )}
          <button type="button" className="btn btn-secondary" onClick={handleBackToMenu}>
            退出する
          </button>
          {errorMessage && <p className="error-text">{errorMessage}</p>}
        </div>
      )}

      {room && (room.status === "playing" || room.status === "finished") && (
        <>
          <div className="troll-game-hud">
            <div className="troll-game-stat">
              <span className="troll-game-stat-label">スコア</span>
              <span className="troll-game-stat-value">{me?.score ?? 0}</span>
            </div>
            <div className="troll-game-stat">
              <span className="troll-game-stat-label">コンボ</span>
              <span className="troll-game-stat-value">{me?.combo ?? 0}</span>
            </div>
            <div className="troll-game-stat">
              <span className="troll-game-stat-label">残り時間</span>
              <span className="troll-game-stat-value">{remainingSec}秒</span>
            </div>
            <div className="troll-game-stat">
              <span className="troll-game-stat-label">自己ベスト</span>
              <span className="troll-game-stat-value" suppressHydrationWarning>
                {best ?? "-"}
              </span>
            </div>
          </div>

          <ul className="troll-game-party-scoreboard">
            {sortedPlayers.map((p) => (
              <li key={p.id} className={p.id === playerId ? "is-me" : undefined}>
                <span className="troll-game-party-name">{p.name}</span>
                <span className="troll-game-party-score">{p.score}</span>
              </li>
            ))}
          </ul>

          <div className="troll-game-stage">
            <div
              className={`troll-game-board${room.status === "playing" ? " is-playing" : ""}`}
              style={{ "--beat-ms": `${60000 / room.bpm}ms` } as React.CSSProperties}
              onClick={handleBoardMissClick}
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setPointer(null)}
            >
              <span key={beatPulseToken} className="troll-game-beat-ring" />

              {room.targets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  className={`troll-game-target troll-game-target-${target.type}`}
                  style={{ left: `${target.x}%`, top: `${target.y}%` }}
                  onClick={(e) => handleTargetClick(target, e)}
                  aria-label={target.type === "troll" ? "トロールを通報する" : "エンジョイ勢"}
                >
                  {target.type === "troll" ? "😈" : "😊"}
                </button>
              ))}

              {floatTexts.map((f) => (
                <span
                  key={f.id}
                  className={`troll-game-float troll-game-float-${f.kind}`}
                  style={{ left: `${f.x}%`, top: `${f.y}%` }}
                >
                  <strong>{f.text}</strong>
                  <small>{f.sub}</small>
                </span>
              ))}

              {room.status === "playing" && pointer && (
                <span
                  className="troll-game-reticle"
                  style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }}
                  aria-hidden
                />
              )}
            </div>

            {room.status === "finished" && (
              <div className="troll-game-overlay">
                <p className="troll-game-result-score">
                  {sortedPlayers[0]?.name === (me?.name ?? "") ? "優勝!" : "結果発表"}
                </p>
                <ol className="troll-game-result-list">
                  {sortedPlayers.map((p, i) => (
                    <li key={p.id} className={p.id === playerId ? "is-me" : undefined}>
                      <span className="troll-game-result-rank">{i + 1}位</span>
                      <span>{p.name}</span>
                      <span className="troll-game-result-points">{p.score}</span>
                    </li>
                  ))}
                </ol>
                {isNewBest && <p className="troll-game-new-best">自己ベスト更新!</p>}
                {isHost ? (
                  <button type="button" className="btn" onClick={handleStart}>
                    もう一度プレイ
                  </button>
                ) : (
                  <p className="muted">ホストの再開始を待っています…</p>
                )}
                <button type="button" className="btn btn-secondary" onClick={handleBackToMenu}>
                  メニューに戻る
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
