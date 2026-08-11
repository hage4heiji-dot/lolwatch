import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 記事本文はMarkdownで保存する。react-markdownは既定で生HTMLをレンダリングしない
// (rehype-raw等を追加しない限りタグはそのままテキスト表示される)ため、
// サニタイズライブラリなしでXSSを防げる。
export function ArticleBody({ body }: { body: string }) {
  return (
    <div className="article-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}
