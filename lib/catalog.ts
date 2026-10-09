import { query } from "@/lib/db";

/**
 * Listes que l'on complète soi-même : catégories d'exercice, matériel,
 * catégories de séance. La fiche recopie le nom ; renommer une entrée le
 * répercute partout, et on ne supprime que ce qui ne sert plus.
 */
export const CATALOG_KINDS = ["exercise_category", "equipment", "program_category"] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export type CatalogEntry = { name: string; uses: number };

export const MAX_CATALOG_NAME = 40;

export function isCatalogKind(value: unknown): value is CatalogKind {
  return CATALOG_KINDS.includes(value as CatalogKind);
}

/** Où chaque liste est employée : table et colonne. */
const USAGE: Record<CatalogKind, { table: string; column: string }> = {
  exercise_category: { table: "exercises", column: "category" },
  equipment: { table: "exercises", column: "equipment" },
  program_category: { table: "programs", column: "category" },
};

export async function listCatalog(kind: CatalogKind): Promise<CatalogEntry[]> {
  const { table, column } = USAGE[kind];
  const rows = await query<{ name: string; uses: number | string }>(
    `select c.name, (select count(*) from ${table} t where t.${column} = c.name) as uses
       from catalog c
      where c.kind = $1
      order by lower(c.name)`,
    [kind],
  );
  return rows.map((row) => ({ name: row.name, uses: Number(row.uses) }));
}

function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ").slice(0, MAX_CATALOG_NAME);
  return name || null;
}

export type CatalogResult = { ok: true } | { error: string };

export async function addCatalog(kind: CatalogKind, raw: unknown): Promise<CatalogResult> {
  const name = cleanName(raw);
  if (!name) return { error: "Donne un nom." };
  const rows = await query<{ name: string }>(
    `insert into catalog (kind, name) values ($1, $2) on conflict do nothing returning name`,
    [kind, name],
  );
  return rows.length > 0 ? { ok: true } : { error: `« ${name} » existe déjà.` };
}

/** Renomme une entrée et toutes les fiches qui l'emploient, en une instruction. */
export async function renameCatalog(kind: CatalogKind, from: string, raw: unknown): Promise<CatalogResult> {
  const name = cleanName(raw);
  if (!name) return { error: "Donne un nom." };
  if (name === from) return { ok: true };
  const { table, column } = USAGE[kind];
  const rows = await query<{ renamed: boolean }>(
    `with entry as (
       update catalog set name = $3
        where kind = $1 and name = $2
          and not exists (select 1 from catalog where kind = $1 and name = $3)
       returning name
     ), cards as (
       update ${table} set ${column} = $3
        where ${column} = $2 and exists (select 1 from entry)
     )
     select exists (select 1 from entry) as renamed`,
    [kind, from, name],
  );
  return rows[0]?.renamed ? { ok: true } : { error: `« ${name} » existe déjà.` };
}

export async function deleteCatalog(kind: CatalogKind, name: string): Promise<CatalogResult> {
  const { table, column } = USAGE[kind];
  const rows = await query<{ name: string }>(
    `delete from catalog
      where kind = $1 and name = $2
        and not exists (select 1 from ${table} where ${column} = $2)
     returning name`,
    [kind, name],
  );
  return rows.length > 0 ? { ok: true } : { error: `« ${name} » est encore utilisé.` };
}
