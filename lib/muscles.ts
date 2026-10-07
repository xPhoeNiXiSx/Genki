/**
 * Groupes musculaires reconnus, dans l'ordre où ils se lisent sur le corps,
 * de haut en bas. La clé est ce qui est stocké en base (`exercises.muscles`)
 * et ce qui reliera chaque groupe à sa zone sur le schéma du corps : elle ne
 * doit donc jamais changer. Le libellé, lui, peut évoluer librement.
 */
export const MUSCLES = [
  { key: "trapezes", label: "Trapèzes" },
  { key: "epaules", label: "Épaules" },
  { key: "pectoraux", label: "Pectoraux" },
  { key: "biceps", label: "Biceps" },
  { key: "triceps", label: "Triceps" },
  { key: "avant-bras", label: "Avant-bras" },
  { key: "dorsaux", label: "Dorsaux" },
  { key: "abdominaux", label: "Abdominaux" },
  { key: "obliques", label: "Obliques" },
  { key: "lombaires", label: "Lombaires" },
  { key: "fessiers", label: "Fessiers" },
  { key: "adducteurs", label: "Adducteurs" },
  { key: "quadriceps", label: "Quadriceps" },
  { key: "ischio-jambiers", label: "Ischio-jambiers" },
  { key: "mollets", label: "Mollets" },
] as const;

export type MuscleKey = (typeof MUSCLES)[number]["key"];

const KEYS = new Set<string>(MUSCLES.map((muscle) => muscle.key));

export function isMuscleKey(value: string): value is MuscleKey {
  return KEYS.has(value);
}

export function muscleLabel(key: MuscleKey): string {
  return MUSCLES.find((muscle) => muscle.key === key)?.label ?? key;
}

/** Trie et dédoublonne selon l'ordre du corps, en écartant l'inconnu. */
export function normalizeMuscles(values: string[]): MuscleKey[] {
  const wanted = new Set(values);
  return MUSCLES.filter((muscle) => wanted.has(muscle.key)).map(
    (muscle) => muscle.key,
  );
}
