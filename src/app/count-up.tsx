"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 1400;

// 数値を0から目標値までカウントアップ表示する。SSR・JS無効時・視差効果を減らす設定の
// 環境では最初から目標値を表示する(クローラーや読み上げで0が読まれないように)。
export function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    // 初期値が目標値なので、アニメーションしない場合は何もしなくてよい。
    if (value === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / DURATION_MS, 1);
      // easeOutCubic: 最後にゆっくり止まる
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{display.toLocaleString("ja-JP")}</>;
}
