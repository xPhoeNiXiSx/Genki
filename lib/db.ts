import { neon } from "@neondatabase/serverless";

import { SCHEMA_STATEMENTS } from "@/lib/schema";

/**
 * Accès Postgres. Une seule fonction `query`, volontairement bas niveau :
 * elle permet de rejouer exactement les mêmes requêtes contre une base de test
 * en mémoire (voir `scripts/test-db.ts`).
 */

export type QueryRunner = <T>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;

let runner: QueryRunner | undefined;

/** Permet aux tests d'injecter une base locale à la place de Neon. */
export function setQueryRunner(custom: QueryRunner): void {
  runner = custom;
}

function neonRunner(): QueryRunner {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL n'est pas définie. Ajoute la chaîne de connexion Postgres dans les variables d'environnement Vercel.",
    );
  }

  const sql = neon(url);
  return async <T>(text: string, params: unknown[] = []) =>
    (await sql.query(text, params)) as T[];
}

export async function query<T>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  runner ??= neonRunner();
  return runner<T>(text, params);
}

/** `true` si une base est configurée, sans tenter de s'y connecter. */
export function isDatabaseConfigured(): boolean {
  return Boolean(runner ?? process.env.DATABASE_URL);
}

/**
 * Applique le schéma. Rejouable : chaque instruction est idempotente.
 *
 * Les instructions partent une par une, et pas en un seul bloc, parce que le
 * pilote HTTP de Neon refuse les requêtes multi-instructions.
 */
export async function runMigrations(): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await query(statement);
  }
}

/**
 * `true` si le schéma est à jour : on teste la table et la colonne ajoutées
 * en dernier dans `lib/schema.ts`. À faire suivre à chaque nouvel ajout.
 */
export async function isSchemaReady(): Promise<boolean> {
  const rows = await query<{ present: boolean }>(
    `select to_regclass('public.catalog') is not null
            and exists (select 1 from information_schema.columns
                         where table_schema = 'public'
                           and table_name = 'exercises'
                           and column_name = 'active') as present`,
  );
  return rows[0]?.present === true;
}

/**
 * Met la base à jour si besoin. Les migrations sont idempotentes et
 * n'effacent rien : on peut les lancer sans demander.
 */
export async function ensureSchema(): Promise<void> {
  if (await isSchemaReady()) return;
  await runMigrations();
}
