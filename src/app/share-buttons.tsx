"use client";

import { useState } from "react";

export function ShareButtons({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードAPIが使えない環境(非HTTPS等)では何もしない
    }
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
        Xでシェア
      </a>
      <button type="button" className="btn btn-secondary" onClick={copyLink}>
        {copied ? "コピーしました" : "リンクをコピー"}
      </button>
    </div>
  );
}
