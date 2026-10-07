import Link from "next/link";
import { connection } from "next/server";

import { isSchemaReady } from "@/lib/db";

import { DatabaseErrorScreen, SetupScreen, missingEnv } from "./db-screens";

export default async function HomePage() {
  // Lue à chaque visite : l'état de la base ne doit pas être figé au build.
  await connection();

  const missing = missingEnv();
  if (missing.length > 0) return <SetupScreen missing={missing} />;

  let ready: boolean;
  try {
    ready = await isSchemaReady();
  } catch (error) {
    return <DatabaseErrorScreen message={String(error)} />;
  }

  return (
    <main className="page">
      <h1 className="page-title">Genki</h1>

      {ready ? (
        <div className="panel">
          <h2>Fondations en place</h2>
          <p className="hint">
            Connexion, base et installation sur l&apos;écran d&apos;accueil
            fonctionnent. Les écrans arrivent une fois la direction graphique
            choisie.
          </p>
        </div>
      ) : (
        <div className="panel">
          <h2>Base à initialiser</h2>
          <p className="hint">
            Ouvre <Link href="/compte">Mon compte</Link> et lance{" "}
            <strong>Appliquer les migrations</strong>.
          </p>
        </div>
      )}

      <p>
        <Link href="/compte">Mon compte</Link>
      </p>
    </main>
  );
}
