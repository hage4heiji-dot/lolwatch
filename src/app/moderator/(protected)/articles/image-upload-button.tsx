"use client";

export function ImageUploadButton({
  pending,
  onFileSelected,
}: {
  pending: boolean;
  onFileSelected: (file: File) => void;
}) {
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onFileSelected(file);
  }

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileChange}
        disabled={pending}
        id="article-image-upload"
      />
      <label
        htmlFor="article-image-upload"
        className="muted"
        style={{ display: "block", marginTop: "0.25rem", fontSize: "0.8rem" }}
      >
        {pending
          ? "アップロード中…"
          : "画像(スクショ等)を選択、または本文欄に貼り付け(Ctrl+V)すると挿入されます"}
      </label>
    </div>
  );
}
