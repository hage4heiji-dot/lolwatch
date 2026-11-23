"use client";

// Riotのデータリクエストで届くzipをブラウザ内だけで読み、通報された回数・通報した回数・
// ペナルティ履歴を表示する。zipにはメールアドレスやログイン履歴など多くの個人情報が
// 含まれるため、ファイルはサーバーへ一切送信せず、必要な数ファイルだけを展開する。
import { useState } from "react";
import { unzip } from "fflate";
import { RiotReportCompare } from "./riot-report-compare";
import { RIOT_REPORT_CATEGORY_LABELS as REPORT_CATEGORY_LABELS } from "@/lib/reportCountTitle";

type GroupedReports = {
  reports_made: Record<string, number>;
  reports_received: Record<string, number>;
};

type Penalty = {
  date_issued?: string | null;
  restriction_reason?: string | null;
  restriction_type?: string | null;
  scope?: string | null;
  sentence?: string | null;
  status?: string | null;
};

type GameKey = "lol" | "tft" | "valorant";

type ParsedData = {
  reports: Partial<Record<GameKey, GroupedReports>>;
  penalties: Penalty[] | null;
  // Riot ID(+地域)のSHA-256。匿名統計で同じアカウントの重複登録を防ぐためだけに使う。
  // Riot ID自体はこのコンポーネントの外に出さない。
  riotIdHash: string | null;
};

// zip内のパス(末尾一致で探す。展開ツールによって先頭にフォルダが付く場合があるため)。
const TARGET_FILES: Record<GameKey | "penalties" | "summoner", string> = {
  lol: "leagueoflegends/grouped_reports.json",
  tft: "teamfighttactics/tft_grouped_reports.json",
  valorant: "valorant/valorant_grouped_reports.json",
  penalties: "penalties/penalty_history.json",
  summoner: "leagueoflegends/summoner.json",
};

const GAME_LABELS: Record<GameKey, string> = {
  lol: "League of Legends",
  tft: "チームファイト タクティクス",
  valorant: "VALORANT",
};

const PENALTY_REASON_LABELS: Record<string, string> = {
  LEAVER_BUSTER: "放置・途中離脱(リーバーバスター)",
  VERBAL_ABUSE: "暴言",
  HATE_SPEECH: "ヘイトスピーチ",
  INAPPROPRIATE_NAME: "不適切な名前",
  CHEATING: "チート",
  BOTTING: "Bot・自動操作",
};

const PENALTY_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "有効",
  LAPSED: "期間終了",
  REVOKED: "取り消し",
  EXPIRED: "期間終了",
};

const PENALTY_SCOPE_LABELS: Record<string, string> = {
  LEAGUE_OF_LEGENDS: "LoL",
  TEAMFIGHT_TACTICS: "TFT",
  VALORANT: "VALORANT",
  RIOT_ACCOUNT: "Riotアカウント",
};

const MAX_FILE_BYTES = 500 * 1024 * 1024;

function label(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "-";
  return map[key] ?? key;
}

function isCountMap(value: unknown): value is Record<string, number> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((v) => typeof v === "number")
  );
}

function parseGroupedReports(text: string): GroupedReports | null {
  const json: unknown = JSON.parse(text);
  if (typeof json !== "object" || json === null) return null;
  const { reports_made, reports_received } = json as Record<string, unknown>;
  if (!isCountMap(reports_made) || !isCountMap(reports_received)) return null;
  return { reports_made, reports_received };
}

function unzipTargets(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  const targets = Object.values(TARGET_FILES);
  return new Promise((resolve, reject) => {
    unzip(data, { filter: (file) => targets.some((t) => file.name.endsWith(t)) }, (err, files) =>
      err ? reject(err) : resolve(files),
    );
  });
}

async function hashRiotId(summonerText: string | null): Promise<string | null> {
  if (!summonerText) return null;
  const json: unknown = JSON.parse(summonerText);
  if (typeof json !== "object" || json === null) return null;
  const { riot_id, lol_platform } = json as Record<string, unknown>;
  if (typeof riot_id !== "string" || riot_id === "") return null;
  const source = `${typeof lol_platform === "string" ? lol_platform : ""}:${riot_id.normalize("NFKC").toLowerCase()}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function parseZip(file: File): Promise<ParsedData> {
  const files = await unzipTargets(new Uint8Array(await file.arrayBuffer()));
  const decoder = new TextDecoder();
  const read = (target: string) => {
    const name = Object.keys(files).find((n) => n.endsWith(target));
    return name ? decoder.decode(files[name]) : null;
  };

  const reports: ParsedData["reports"] = {};
  for (const game of ["lol", "tft", "valorant"] as const) {
    const text = read(TARGET_FILES[game]);
    const parsed = text ? parseGroupedReports(text) : null;
    if (parsed) reports[game] = parsed;
  }

  const penaltiesText = read(TARGET_FILES.penalties);
  const penaltiesJson: unknown = penaltiesText ? JSON.parse(penaltiesText) : null;
  const penalties = Array.isArray(penaltiesJson) ? (penaltiesJson as Penalty[]) : null;

  return {
    reports,
    penalties,
    riotIdHash: await hashRiotId(read(TARGET_FILES.summoner)),
  };
}

function sum(counts: Record<string, number>): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

function sortedEntries(counts: Record<string, number>): [string, number][] {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function CountBars({ counts }: { counts: Record<string, number> }) {
  const entries = sortedEntries(counts);
  if (entries.length === 0) return <p className="muted">0回</p>;
  const max = entries[0][1];
  return (
    <div>
      {entries.map(([key, count]) => (
        <div className="stat-bar-row" key={key}>
          <span className="stat-bar-label">{label(REPORT_CATEGORY_LABELS, key)}</span>
          <div className="stat-bar-track">
            <div className="stat-bar-fill" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="stat-bar-count">{count}回</span>
        </div>
      ))}
    </div>
  );
}

// showTotals=false はLoL用(合計は上の結果カードに出すので内訳だけ表示する)。
function GameReports({
  game,
  reports,
  showTotals = true,
}: {
  game: GameKey;
  reports: GroupedReports;
  showTotals?: boolean;
}) {
  const received = sum(reports.reports_received);
  const made = sum(reports.reports_made);
  return (
    <div className="riot-data-game">
      <h3>{showTotals ? GAME_LABELS[game] : `${GAME_LABELS[game]} の内訳`}</h3>
      {showTotals && (
        <div className="stat-grid riot-data-totals">
          <div className="card stat-card">
            <p className="stat-card-icon">🚩</p>
            <p className={`stat-card-value${received > 0 ? " stat-card-value-danger" : ""}`}>
              {received}回
            </p>
            <p className="muted">通報された回数</p>
          </div>
          <div className="card stat-card">
            <p className="stat-card-icon">📢</p>
            <p className="stat-card-value">{made}回</p>
            <p className="muted">通報した回数</p>
          </div>
        </div>
      )}
      {received > 0 && (
        <>
          <p style={{ marginTop: "0.75rem" }}>
            <strong>通報された理由の内訳</strong>
          </p>
          <CountBars counts={reports.reports_received} />
        </>
      )}
      {made > 0 && (
        <>
          <p style={{ marginTop: "0.75rem" }}>
            <strong>通報した理由の内訳</strong>
          </p>
          <CountBars counts={reports.reports_made} />
        </>
      )}
    </div>
  );
}

export function RiotDataReader() {
  const [result, setResult] = useState<ParsedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File | undefined) {
    setResult(null);
    setError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("ファイルが大きすぎます。Riotから届いたzipファイルを選んでください。");
      return;
    }
    setLoading(true);
    try {
      const parsed = await parseZip(file);
      if (Object.keys(parsed.reports).length === 0 && parsed.penalties === null) {
        setError(
          "通報に関するデータが見つかりませんでした。Riotのデータリクエストで届いたzipファイルを、展開せずにそのまま選んでください。",
        );
      } else {
        setResult(parsed);
      }
    } catch {
      setError(
        "ファイルを読み込めませんでした。Riotのデータリクエストで届いたzipファイルを、展開せずにそのまま選んでください。",
      );
    } finally {
      setLoading(false);
    }
  }

  const games = result ? (Object.keys(result.reports) as GameKey[]) : [];
  // LoL以外は通報が0件なら表示を省く(ほとんどの人は遊んでいないゲームなので)。
  const visibleGames = games.filter((g) => {
    const r = result!.reports[g]!;
    return g === "lol" || sum(r.reports_received) + sum(r.reports_made) > 0;
  });

  return (
    <div className="riot-data-reader">
      <label className="btn riot-data-file-btn">
        📂 zipファイルを選ぶ
        <input
          type="file"
          accept=".zip,application/zip"
          onChange={(e) => handleFile(e.target.files?.[0])}
          hidden
        />
      </label>
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        🔒
        ファイルはお使いのブラウザの中だけで読み込みます。lolwatchのサーバーには送信・保存されません。
      </p>

      {loading && <p style={{ marginTop: "1rem" }}>読み込み中…</p>}
      {error && (
        <p className="error-text" style={{ marginTop: "1rem" }}>
          {error}
        </p>
      )}

      {result && (
        <div className="riot-data-result">
          {result.reports.lol && (
            <RiotReportCompare
              riotIdHash={result.riotIdHash}
              receivedByCategory={result.reports.lol.reports_received}
              madeByCategory={result.reports.lol.reports_made}
              penaltyCount={result.penalties?.length ?? 0}
            />
          )}

          {visibleGames.map((game) => (
            <GameReports
              key={game}
              game={game}
              reports={result.reports[game]!}
              showTotals={game !== "lol"}
            />
          ))}

          <div className="riot-data-game">
            <h3>ペナルティ履歴</h3>
            {!result.penalties || result.penalties.length === 0 ? (
              <p className="muted">ペナルティの記録はありません。</p>
            ) : (
              <ul className="riot-data-penalties">
                {result.penalties.map((p, i) => (
                  <li key={i} className="card">
                    <strong>{label(PENALTY_REASON_LABELS, p.restriction_reason)}</strong>
                    <span className="muted">
                      {formatDate(p.date_issued)} ・ {label(PENALTY_SCOPE_LABELS, p.scope)} ・{" "}
                      {label(PENALTY_STATUS_LABELS, p.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="muted">
            ※
            回数はRiotのデータに含まれる集計値をそのまま表示しています。いつからの集計か、通報がどう扱われたかは含まれていません。
          </p>
        </div>
      )}
    </div>
  );
}
