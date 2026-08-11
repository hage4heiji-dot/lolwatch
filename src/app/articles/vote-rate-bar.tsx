const SCALE = [1, 2, 3, 4, 5] as const;

// 記事一覧(簡易表示)・記事詳細(投票フォーム付き)の両方から使う、投票分布バーの見た目部分だけ。
export function VoteRateBar({
  scoreCounts,
  compact = false,
}: {
  scoreCounts: Record<number, number>;
  compact?: boolean;
}) {
  const total = SCALE.reduce((sum, s) => sum + (scoreCounts[s] ?? 0), 0);

  return (
    <div>
      <div className="violation-bar-track" style={compact ? { height: "0.4rem" } : undefined}>
        {SCALE.map((score) => {
          const count = scoreCounts[score] ?? 0;
          const percent = total === 0 ? 20 : (count / total) * 100;
          return (
            <div
              key={score}
              className={`violation-bar-segment-${score}`}
              style={{ width: `${percent}%` }}
            />
          );
        })}
      </div>
      {!compact && (
        <div className="violation-bar-labels">
          <span>⚠️ 違反</span>
          <span>✅ 問題なし</span>
        </div>
      )}
    </div>
  );
}
