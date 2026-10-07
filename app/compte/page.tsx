import { logoutAction } from "../login/actions";
import { SubmitButton } from "../submit-button";
import { migrateAction } from "./actions";

export default async function ComptePage({
  searchParams,
}: {
  searchParams: Promise<{ migre?: string }>;
}) {
  const { migre } = await searchParams;

  return (
    <main className="page">
      <h1 className="page-title">Mon compte</h1>

      <form action={migrateAction} className="panel form">
        <h2>Base de données</h2>
        <p className="hint">
          Crée ou met à jour les tables. Sans risque : rien n&apos;est jamais
          supprimé, et le relancer sur une base à jour ne change rien.
        </p>
        {migre ? <p className="hint">Migrations appliquées.</p> : null}
        <SubmitButton pendingLabel="Application…">
          Appliquer les migrations
        </SubmitButton>
      </form>

      <form action={logoutAction}>
        <button type="submit" className="secondary">
          Se déconnecter
        </button>
      </form>
    </main>
  );
}
