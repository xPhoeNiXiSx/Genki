import Link from "next/link";

import { logoutAction } from "../login/actions";
import { SubmitButton } from "../submit-button";
import { Icon } from "../ui/icons";
import { Lanes } from "../ui/lanes";
import { migrateAction } from "./actions";

export default async function ComptePage({ searchParams }: { searchParams: Promise<{ migre?: string }> }) {
  const { migre } = await searchParams;

  return (
    <main className="screen bare">
      <Lanes />
      <div className="top-bar">
        <Link href="/" className="round" aria-label="Retour à l'accueil"><Icon name="back" size={20} /></Link>
      </div>
      <h1 className="display" style={{ fontSize: 34, marginTop: 18 }}>Mon compte</h1>

      <form action={migrateAction} className="galet form" style={{ marginTop: 24 }}>
        <h2 className="display" style={{ fontSize: 16 }}>Base de données</h2>
        <p className="muted" style={{ margin: 0, lineHeight: 1.45 }}>
          Crée ou met à jour les tables. Sans risque : rien n&apos;est jamais supprimé, et le relancer sur une base à jour ne change rien.
        </p>
        {migre ? <p style={{ margin: 0, fontWeight: 700 }}>Migrations appliquées.</p> : null}
        <SubmitButton className="btn" pendingLabel="Application…">Appliquer les migrations</SubmitButton>
      </form>

      <form action={logoutAction} style={{ marginTop: 14 }}>
        <button type="submit" className="btn volt wide">Se déconnecter</button>
      </form>
    </main>
  );
}
