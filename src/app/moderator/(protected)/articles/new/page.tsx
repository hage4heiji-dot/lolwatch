import { ArticleCreateForm } from "./article-create-form";

export default function NewArticlePage() {
  return (
    <div>
      <h1>記事を新規作成</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
        作成後は下書き状態になります。内容を確認してから公開してください。
      </p>
      <ArticleCreateForm />
    </div>
  );
}
