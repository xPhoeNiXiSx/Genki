import { query } from "@/lib/db";

/**
 * Sauvegarde complète de l'appli, en JSON : exercices, séances (programmes),
 * étapes, historique, réglages et listes.
 *
 * L'import est une restauration : il remplace toutes les données par celles
 * du fichier. Les colonnes absentes d'un fichier plus ancien reprennent leur
 * valeur par défaut. Toute colonne ajoutée au schéma doit être déclarée ici.
 */

export const BACKUP_VERSION = 1;

type Column = { name: string; fallback?: unknown };

const TABLES: { table: string; columns: Column[] }[] = [
  {
    table: "exercises",
    columns: [
      { name: "id" }, { name: "name" }, { name: "description", fallback: null }, { name: "image_url", fallback: null },
      { name: "category" }, { name: "equipment", fallback: null }, { name: "muscles", fallback: [] },
      { name: "active", fallback: true },
      { name: "created_at" }, { name: "updated_at" },
    ],
  },
  {
    table: "programs",
    columns: [
      { name: "id" }, { name: "name" }, { name: "notes", fallback: null }, { name: "category", fallback: null },
      { name: "rounds", fallback: 1 }, { name: "prep_seconds", fallback: 10 }, { name: "sound", fallback: "gong" },
      { name: "created_at" }, { name: "updated_at" },
    ],
  },
  {
    table: "program_steps",
    columns: [
      { name: "id" }, { name: "program_id" }, { name: "position" }, { name: "kind", fallback: "exercise" },
      { name: "exercise_id", fallback: null }, { name: "label", fallback: null }, { name: "duration_seconds" },
      { name: "reps", fallback: null }, { name: "loop_group", fallback: null }, { name: "loop_rounds", fallback: null },
    ],
  },
  {
    table: "workout_sessions",
    columns: [
      { name: "id" }, { name: "program_id", fallback: null }, { name: "program_name" }, { name: "started_at" },
      { name: "duration_seconds", fallback: 0 }, { name: "completed", fallback: false },
      { name: "feeling", fallback: null }, { name: "note", fallback: null },
      { name: "steps_done", fallback: null }, { name: "steps_total", fallback: null },
    ],
  },
  {
    table: "settings",
    columns: [{ name: "key" }, { name: "value" }, { name: "updated_at" }],
  },
  {
    table: "catalog",
    columns: [{ name: "kind" }, { name: "name" }],
  },
];

export type Backup = {
  app: "genki";
  version: number;
  exportedAt: string;
  data: Record<string, Record<string, unknown>[]>;
};

export async function exportData(now = new Date()): Promise<Backup> {
  const data: Backup["data"] = {};
  for (const { table, columns } of TABLES) {
    const names = columns.map((c) => c.name).join(", ");
    data[table] = await query<Record<string, unknown>>(`select ${names} from ${table}`);
  }
  return { app: "genki", version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

/** Résumé d'une restauration, pour le dire à l'utilisateur. */
export type ImportSummary = { exercises: number; programs: number; workouts: number };

export function parseBackup(raw: string): { backup: Backup } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Ce fichier n'est pas un export Genki lisible." };
  }
  const b = parsed as Partial<Backup>;
  if (b?.app !== "genki" || typeof b.version !== "number" || !b.data || typeof b.data !== "object") {
    return { error: "Ce fichier n'est pas un export Genki." };
  }
  if (b.version > BACKUP_VERSION) return { error: "Cet export vient d'une version plus récente de Genki." };
  for (const { table } of TABLES) {
    const rows = (b.data as Record<string, unknown>)[table];
    if (rows !== undefined && !Array.isArray(rows)) return { error: `Export abîmé : « ${table} » illisible.` };
  }
  return { backup: b as Backup };
}

/**
 * Remplace toutes les données par celles de la sauvegarde. Les tables sont
 * vidées des feuilles vers la racine, puis remplies dans l'autre sens, pour
 * respecter les clés étrangères.
 */
export async function importData(backup: Backup): Promise<ImportSummary> {
  const now = new Date().toISOString();
  for (const { table } of [...TABLES].reverse()) await query(`delete from ${table}`);

  for (const { table, columns } of TABLES) {
    const rows = (backup.data[table] ?? []).map((row) => {
      const out: Record<string, unknown> = {};
      for (const c of columns) {
        const value = row[c.name];
        out[c.name] = value === undefined ? (c.fallback !== undefined ? c.fallback : c.name.endsWith("_at") ? now : null) : value;
      }
      return out;
    });
    if (rows.length === 0) continue;
    const names = columns.map((c) => c.name).join(", ");
    await query(
      `insert into ${table} (${names})
       select ${names} from json_populate_recordset(null::${table}, $1::json)`,
      [JSON.stringify(rows)],
    );
  }

  // Un export antérieur aux listes n'en contient pas : on les reconstitue
  // depuis les fiches restaurées.
  await query(
    `insert into catalog (kind, name)
     select 'exercise_category', category from exercises
     union select 'equipment', equipment from exercises where equipment is not null
     union select 'program_category', category from programs where category is not null
     on conflict do nothing`,
  );

  return {
    exercises: backup.data.exercises?.length ?? 0,
    programs: backup.data.programs?.length ?? 0,
    workouts: backup.data.workout_sessions?.length ?? 0,
  };
}
