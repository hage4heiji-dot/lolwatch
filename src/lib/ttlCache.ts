// 短時間キャッシュのための共通ヘルパー。もともとcalibrationStats.tsの集計結果
// キャッシュ用に作ったもの(そちらはddragonバージョンキャッシュ(riot.ts)と同じ方針)を、
// 引数付き(プレイヤーごと・試合ごと等)の関数にも使えるよう汎用化したもの。

export function memoizeWithTtl<T>(fn: () => Promise<T>, ttlMs: number): () => Promise<T> {
  let cached: { value: T; fetchedAt: number } | null = null;
  return async () => {
    if (cached && Date.now() - cached.fetchedAt < ttlMs) {
      return cached.value;
    }
    const value = await fn();
    cached = { value, fetchedAt: Date.now() };
    return value;
  };
}

// キーごとにTTLキャッシュする版。プレイヤーページ等、同じ引数(puuidや試合ID)への
// アクセスが短時間に集中しうる関数向け。無制限にエントリが増えないよう、
// 上限を超えたら古いものから(Map挿入順=FIFO近似で)間引く。
const DEFAULT_MAX_KEYED_CACHE_ENTRIES = 1000;

export function memoizeWithTtlByKey<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  ttlMs: number,
  keyFn: (...args: Args) => string,
  maxEntries = DEFAULT_MAX_KEYED_CACHE_ENTRIES,
): (...args: Args) => Promise<T> {
  const cache = new Map<string, { value: T; fetchedAt: number }>();

  return async (...args: Args) => {
    const key = keyFn(...args);
    const now = Date.now();
    const entry = cache.get(key);
    if (entry && now - entry.fetchedAt < ttlMs) {
      return entry.value;
    }

    const value = await fn(...args);
    // 既存キーの場合も一旦削除してからsetし、挿入順を最新化する(古い順に間引くため)。
    cache.delete(key);
    cache.set(key, { value, fetchedAt: now });
    while (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey === undefined) break;
      cache.delete(oldestKey);
    }
    return value;
  };
}
