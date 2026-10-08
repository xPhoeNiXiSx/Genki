import Link from "next/link";
import { connection } from "next/server";

import { isSchemaReady } from "@/lib/db";

/** Variables d'environnement manquantes, dans l'ordre où les poser. */
export function missingEnv(): string[] {
  return ["DATABASE_URL", "APP_PASSWORD", "AUTH_SECRET"].filter((name) => !process.env[name]);
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="screen bare">
      <p className="logo">genki</p>
      <h1 className="display title">{title}</h1>
      <div className="galet" style={{ marginTop: 20, display: "grid", gap: 10 }}>
        {children}
      </div>
    </main>
  );
}

/**
 * À appeler en tête de chaque page qui lit la base. Renvoie l'écran à
 * afficher si la base n'est pas prête, `null` sinon.
 */
export async function databaseBlocker(): Promise<React.ReactElement | null> {
  // Lu à chaque visite : l'état de la base ne doit pas être figé au build.
  await connection();

  const missing = missingEnv();
  if (missing.length > 0) {
    return (
      <Notice title="Configuration incomplète">
        <p style={{ margin: 0 }}>
          Il manque {missing.length > 1 ? "ces variables" : "cette variable"} d&apos;environnement côté Vercel :
        </p>
        <p className="mono" style={{ margin: 0 }}>{missing.join(" · ")}</p>
        <p className="muted" style={{ margin: 0 }}>Settings → Environment Variables, puis redéploie.</p>
      </Notice>
    );
  }

  try {
    if (await isSchemaReady()) return null;
  } catch (error) {
    return (
      <Notice title="Base injoignable">
        <p className="mono" style={{ margin: 0, fontSize: 12 }}>{String(error)}</p>
        <p className="muted" style={{ margin: 0 }}>Vérifie DATABASE_URL dans les variables Vercel, puis redéploie.</p>
      </Notice>
    );
  }

  return (
    <Notice title="Base à initialiser">
      <p style={{ margin: 0 }}>
        Ouvre <Link href="/compte" style={{ textDecoration: "underline" }}>Mon compte</Link> et lance{" "}
        <strong>Appliquer les migrations</strong>.
      </p>
    </Notice>
  );
}
