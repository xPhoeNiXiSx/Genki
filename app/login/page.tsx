import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="page">
      <h1 className="page-title">Genki</h1>
      <LoginForm next={next ?? ""} />
    </main>
  );
}
