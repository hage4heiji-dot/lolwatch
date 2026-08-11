"use client";

import { useRef, useState } from "react";
import { ArticleBody } from "@/app/article-body";
import { ImageUploadButton } from "./image-upload-button";
import { useImageUpload } from "./use-image-upload";

export function MarkdownEditorField({
  defaultValue,
}: {
  defaultValue: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const { pending, error, uploadFile } = useImageUpload(textareaRef);

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageItem = Array.from(e.clipboardData.items).find((item) =>
      item.type.startsWith("image/"),
    );
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    // 貼り付けたクリップボード画像はファイル選択と同じアップロード処理に流すため、
    // テキストとしての貼り付け(画像データのゴミ文字列化)は止める。
    e.preventDefault();
    uploadFile(file);
  }

  return (
    <div className="form-field">
      <label htmlFor="body">
        本文(Markdown記法: **太字** ・ *斜体* ・ ## 見出し ・ - リスト ・ ![](画像URL) が使えます)
      </label>
      <textarea
        ref={textareaRef}
        id="body"
        name="body"
        rows={14}
        required
        maxLength={20000}
        defaultValue={defaultValue}
        onPaste={handlePaste}
      />
      <ImageUploadButton pending={pending} onFileSelected={uploadFile} />
      {error && <p className="error-text">{error}</p>}
      <button
        type="button"
        className="btn btn-secondary vote-btn"
        style={{ marginTop: "0.5rem" }}
        onClick={() =>
          setPreviewText((current) => (current === null ? textareaRef.current?.value ?? "" : null))
        }
      >
        {previewText === null ? "プレビュー表示" : "プレビューを閉じる"}
      </button>
      {previewText !== null && (
        <div className="card" style={{ marginTop: "0.5rem" }}>
          <ArticleBody body={previewText} />
        </div>
      )}
    </div>
  );
}
