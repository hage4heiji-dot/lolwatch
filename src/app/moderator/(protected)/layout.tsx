import Link from "next/link";
import { requireModerator } from "@/lib/moderatorAuth";
import { logoutAction } from "./actions";

export default async function ModeratorProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const moderator = await requireModerator();

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <nav className="site-nav">
          <Link href="/moderator">ダッシュボード</Link>
          <Link href={`/moderator/moderators/${moderator.id}`}>自分のレビュー一覧</Link>
          <Link href="/moderator/articles">炎上案件記事</Link>
          {moderator.isAdmin && <Link href="/moderator/reports">全通報一覧</Link>}
          {moderator.isAdmin && <Link href="/moderator/moderators">モデレーター別集計</Link>}
        </nav>
        <form action={logoutAction}>
          <button className="btn btn-secondary" type="submit">
            ログアウト
          </button>
        </form>
      </div>
      <p className="muted" style={{ marginBottom: "1.5rem" }}>
        {moderator.displayName} としてログイン中{moderator.isAdmin && "(管理者)"}
      </p>
      {children}
    </div>
  );
}
