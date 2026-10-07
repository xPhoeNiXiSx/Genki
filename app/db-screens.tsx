/** Écrans d'attente partagés par les pages qui lisent la base. */

export function SetupScreen({ missing }: { missing: string[] }) {
  return (
    <main className="page">
      <h1 className="page-title">Genki</h1>
      <div className="panel">
        <h2>Configuration incomplète</h2>
        <p className="hint">
          Il manque {missing.length > 1 ? "ces variables" : "cette variable"}{" "}
          d&apos;environnement côté Vercel :
        </p>
        <ul className="hint">
          {missing.map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
        <p className="hint">
          Settings → Environment Variables, puis redéploie. Le détail est dans
          le README.
        </p>
      </div>
    </main>
  );
}

export function DatabaseErrorScreen({ message }: { message: string }) {
  return (
    <main className="page">
      <h1 className="page-title">Genki</h1>
      <div className="panel">
        <h2>Base injoignable</h2>
        <p className="hint">{message}</p>
        <p className="hint">
          Vérifie <code>DATABASE_URL</code> dans les variables
          d&apos;environnement Vercel, puis redéploie.
        </p>
      </div>
    </main>
  );
}

/** Variables d'environnement manquantes, dans l'ordre où les poser. */
export function missingEnv(): string[] {
  return ["DATABASE_URL", "APP_PASSWORD", "AUTH_SECRET"].filter(
    (name) => !process.env[name],
  );
}
