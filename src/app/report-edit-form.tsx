"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS } from "@/lib/reportCategories";
import { formatMatchTime, parseMatchTime } from "@/lib/matchTime";
import { isSafeVideoUrl } from "@/lib/videoUrl";
import type { ReportCategory } from "@/generated/prisma";

export function ReportEditForm({
  reportId,
  initialCategory,
  initialComment,
  initialIncidentSeconds,
  initialVideoUrl,
}: {
  reportId: string;
  initialCategory: ReportCategory;
  initialComment: string | null;
  initialIncidentSeconds: number | null;
  initialVideoUrl: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState<string>(initialCategory);
  const [comment, setComment] = useState(initialComment ?? "");
  const [incidentTimeInput, setIncidentTimeInput] = useState(
    initialIncidentSeconds !== null ? formatMatchTime(initialIncidentSeconds) : "",
  );
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        className="btn btn-secondary vote-btn"
        onClick={() => setEditing(true)}
      >
        この通報を編集(投稿から1時間以内のみ)
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const incidentSeconds = incidentTimeInput.trim() ? parseMatchTime(incidentTimeInput) : null;
    if (incidentTimeInput.trim() && incidentSeconds === null) {
      setError("目安時間の形式が正しくありません(例: 12:34)。");
      return;
    }
    if (videoUrl.trim() && !isSafeVideoUrl(videoUrl.trim())) {
      setError("動画URLの形式が正しくありません(http/httpsのURLを入力してください)。");
      return;
    }

    setPending(true);
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          comment: comment.trim() || undefined,
          incidentTimestampSeconds: incidentSeconds ?? undefined,
          videoUrl: videoUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "更新に失敗しました。");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: "0.5rem" }}>
      <div className="form-field">
        <label>通報の種別</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} required>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label>コメント(任意 / 300字まで)</label>
        <textarea
          rows={3}
          maxLength={300}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label>問題のシーンの目安時間(任意 / 例: 12:34)</label>
        <input
          placeholder="12:34"
          value={incidentTimeInput}
          onChange={(e) => setIncidentTimeInput(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label>動画URL(任意)</label>
        <input
          type="url"
          placeholder="例: https://www.youtube.com/watch?v=..."
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "更新中…" : "更新する"}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => setEditing(false)}
          disabled={pending}
        >
          キャンセル
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
