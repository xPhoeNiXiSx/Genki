import { Lanes } from "../ui/lanes";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <main className="screen bare">
      <Lanes />
      <p className="katakana" aria-hidden="true">ゲンキ</p>
      <p className="logo">genki</p>
      <span className="logo-sub">元気 · la forme</span>
      <h1 className="display title">Connexion</h1>
      <LoginForm next={next ?? ""} />
    </main>
  );
}
