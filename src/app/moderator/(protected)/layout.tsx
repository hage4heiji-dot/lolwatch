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
          marginBottom: "1.5rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span className="muted">{moderator.displayName} としてログイン中</span>
        <form action={logoutAction}>
          <button className="btn btn-secondary" type="submit">
            ログアウト
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
