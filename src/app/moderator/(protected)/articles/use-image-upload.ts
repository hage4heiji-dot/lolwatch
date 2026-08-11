"use client";

import { useState } from "react";

// ファイル選択・クリップボード貼り付けの両方から呼べる共通アップロード処理。
// 成功時はtextarea(非制御コンポーネント)のカーソル位置にMarkdown画像記法を直接挿入する。
export function useImageUpload(textareaRef: React.RefObject<HTMLTextAreaElement | null>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    setPending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/moderator/uploads", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "アップロードに失敗しました。");
        return;
      }

      const textarea = textareaRef.current;
      const markdown = `![](${data.url})`;
      if (textarea) {
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const before = textarea.value.slice(0, start);
        const after = textarea.value.slice(end);
        const insertion = `${before ? "\n" : ""}${markdown}\n`;
        textarea.value = `${before}${insertion}${after}`;
        const cursor = before.length + insertion.length;
        textarea.focus();
        textarea.setSelectionRange(cursor, cursor);
      }
    } catch {
      setError("通信に失敗しました。しばらくしてから再度お試しください。");
    } finally {
      setPending(false);
    }
  }

  return { pending, error, uploadFile };
}
