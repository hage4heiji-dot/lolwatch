import { LoginForm } from "./login-form";

export default function ModeratorLoginPage() {
  return (
    <div>
      <h1>モデレーターログイン</h1>
      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
        一般ユーザー向けの機能ではありません。モデレーターのみ利用できます。
      </p>
      <LoginForm />
    </div>
  );
}
