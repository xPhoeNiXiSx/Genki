import { query } from "@/lib/db";
import { MAX_STEP_SECONDS } from "@/lib/duration";
import { normalizeMuscles, type MuscleKey } from "@/lib/muscles";

/**
 * Une étape est soit un exercice de la bibliothèque, soit un temps de repos,
 * soit un échauffement. Le libellé nomme le repos ou l'échauffement ; pour un
 * exercice, il le précise (« jambe gauche »), ou garde son nom si l'exercice
 * a été supprimé de la bibliothèque.
 */
export const STEP_KINDS = ["exercise", "rest", "warmup"] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const STEP_KIND_LABELS: Record<StepKind, string> = {
  exercise: "Exercice",
  rest: "Repos",
  warmup: "Échauffement",
};

/** Sons possibles au changement d'étape. */
export const SOUNDS = [
  { key: "gong", label: "Gong" },
  { key: "bip", label: "Bip" },
  { key: "cloche", label: "Cloche" },
] as const;
export type SoundKey = (typeof SOUNDS)[number]["key"];

export const PROGRAM_CATEGORIES = ["Kiné", "Renfo", "Course"];

export const MAX_ROUNDS = 20;
export const MAX_PREP_SECONDS = 60;

export type StepInput = {
  kind: StepKind;
  exerciseId: string | null;
  label: string | null;
  durationSeconds: number;
};

export type ProgramInput = {
  name: string;
  category: string | null;
  notes: string | null;
  rounds: number;
  prepSeconds: number;
  sound: SoundKey;
  steps: StepInput[];
};

/** Une étape prête pour l'affichage et la séance : nom et muscles. */
export type Step = StepInput & {
  name: string;
  muscles: MuscleKey[];
};

export type Program = Omit<ProgramInput, "steps"> & {
  id: string;
  steps: Step[];
};

export type ProgramSummary = {
  id: string;
  name: string;
  category: string | null;
  rounds: number;
  stepCount: number;
  /** Durée d'un tour. */
  totalSeconds: number;
  lastDoneAt: Date | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isSound(value: unknown): value is SoundKey {
  return SOUNDS.some((s) => s.key === value);
}

function isKind(value: unknown): value is StepKind {
  return STEP_KINDS.includes(value as StepKind);
}

/** Durée d'un tour, en secondes. */
export function roundSeconds(steps: { durationSeconds: number }[]): number {
  return steps.reduce((sum, step) => sum + step.durationSeconds, 0);
}

/**
 * Lit le programme envoyé par l'éditeur, en JSON. Renvoie l'erreur à
 * afficher, le cas échéant, en nommant l'étape fautive.
 */
export function parseProgramPayload(raw: unknown): { input: ProgramInput } | { error: string } {
  let data: unknown;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return { error: "Le programme envoyé est illisible." };
  }
  if (!data || typeof data !== "object") return { error: "Le programme envoyé est illisible." };
  const d = data as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const name = text(d.name).slice(0, 120);
  if (!name) return { error: "Donne un nom au programme." };

  const rounds = Number(d.rounds ?? 1);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > MAX_ROUNDS) {
    return { error: `Le nombre de tours va de 1 à ${MAX_ROUNDS}.` };
  }
  const prepSeconds = Number(d.prepSeconds ?? 10);
  if (!Number.isInteger(prepSeconds) || prepSeconds < 0 || prepSeconds > MAX_PREP_SECONDS) {
    return { error: `Le temps de préparation va de 0 à ${MAX_PREP_SECONDS} secondes.` };
  }
  const sound = d.sound ?? "gong";
  if (!isSound(sound)) return { error: "Son de transition inconnu." };

  if (!Array.isArray(d.steps) || d.steps.length === 0) return { error: "Ajoute au moins une étape." };

  const steps: StepInput[] = [];
  for (const [i, rawStep] of d.steps.entries()) {
    const position = `Étape ${i + 1}`;
    const step = (rawStep ?? {}) as Record<string, unknown>;
    if (!isKind(step.kind)) return { error: `${position} : type d'étape inconnu.` };
    const exerciseId = step.exerciseId ? text(step.exerciseId) : null;
    if (exerciseId && !UUID.test(exerciseId)) return { error: `${position} : exercice inconnu.` };
    const label = text(step.label).slice(0, 120) || null;
    if (step.kind === "exercise" && !exerciseId && !label) {
      return { error: `${position} : choisis un exercice.` };
    }
    const durationSeconds = Number(step.durationSeconds);
    if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
      return { error: `${position} : durée invalide.` };
    }
    if (durationSeconds > MAX_STEP_SECONDS) return { error: `${position} : une étape ne dépasse pas 3 heures.` };

    steps.push({
      kind: step.kind,
      exerciseId: step.kind === "exercise" ? exerciseId : null,
      label: label ?? (step.kind === "exercise" ? null : STEP_KIND_LABELS[step.kind]),
      durationSeconds,
    });
  }

  return {
    input: {
      name,
      category: text(d.category).slice(0, 40) || null,
      notes: text(d.notes) || null,
      rounds,
      prepSeconds,
      sound,
      steps,
    },
  };
}

/**
 * Remplace toutes les étapes d'un programme, en une seule instruction : le
 * pilote HTTP de Neon n'offre pas de transaction entre deux requêtes, et un
 * échec entre l'effacement et la réécriture laisserait un programme vide.
 */
async function writeSteps(programId: string, steps: StepInput[]): Promise<void> {
  await query(
    `with gone as (delete from program_steps where program_id = $1)
     insert into program_steps (program_id, position, kind, exercise_id, label, duration_seconds)
     select $1, s.ord - 1, s.kind, s.exercise_id, s.label, s.duration
       from unnest($2::text[], $3::uuid[], $4::text[], $5::int[])
            with ordinality as s(kind, exercise_id, label, duration, ord)`,
    [
      programId,
      steps.map((step) => step.kind),
      steps.map((step) => step.exerciseId),
      steps.map((step) => step.label),
      steps.map((step) => step.durationSeconds),
    ],
  );
}

export async function createProgram(input: ProgramInput): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into programs (name, category, notes, rounds, prep_seconds, sound)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [input.name, input.category, input.notes, input.rounds, input.prepSeconds, input.sound],
  );
  const id = rows[0].id;
  await writeSteps(id, input.steps);
  return id;
}

export async function updateProgram(id: string, input: ProgramInput): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `update programs
        set name = $2, category = $3, notes = $4, rounds = $5, prep_seconds = $6,
            sound = $7, updated_at = now()
      where id = $1 returning id`,
    [id, input.name, input.category, input.notes, input.rounds, input.prepSeconds, input.sound],
  );
  if (rows.length === 0) return false;
  await writeSteps(id, input.steps);
  return true;
}

export async function deleteProgram(id: string): Promise<void> {
  await query(`delete from programs where id = $1`, [id]);
}

/** Copie un programme, pour en faire une variante sans toucher à l'original. */
export async function duplicateProgram(id: string): Promise<string | null> {
  const program = await getProgram(id);
  if (!program) return null;
  return createProgram({
    ...program,
    name: `${program.name} (copie)`,
    steps: program.steps.map(({ kind, exerciseId, label, durationSeconds }) => ({
      kind,
      exerciseId,
      label,
      durationSeconds,
    })),
  });
}

export async function getProgram(id: string): Promise<Program | null> {
  const programs = await query<{
    id: string;
    name: string;
    category: string | null;
    notes: string | null;
    rounds: number;
    prep_seconds: number;
    sound: string;
  }>(`select id, name, category, notes, rounds, prep_seconds, sound from programs where id = $1`, [id]);
  const program = programs[0];
  if (!program) return null;

  const steps = await query<{
    kind: string;
    exercise_id: string | null;
    label: string | null;
    duration_seconds: number;
    exercise_name: string | null;
    muscles: string[] | null;
  }>(
    `select s.kind, s.exercise_id, s.label, s.duration_seconds,
            e.name as exercise_name, e.muscles
       from program_steps s
       left join exercises e on e.id = s.exercise_id
      where s.program_id = $1
      order by s.position`,
    [id],
  );

  return {
    id: program.id,
    name: program.name,
    category: program.category,
    notes: program.notes,
    rounds: program.rounds,
    prepSeconds: program.prep_seconds,
    sound: isSound(program.sound) ? program.sound : "gong",
    steps: steps.map((row) => {
      const kind = isKind(row.kind) ? row.kind : "exercise";
      return {
        kind,
        exerciseId: row.exercise_id,
        label: row.label,
        durationSeconds: row.duration_seconds,
        name: stepName(row.exercise_name, row.label, kind),
        muscles: normalizeMuscles(row.muscles ?? []),
      };
    }),
  };
}

/** « Squat — jambe gauche », « Squat », « Repos ». */
export function stepName(exerciseName: string | null, label: string | null, kind: StepKind = "exercise"): string {
  if (exerciseName && label) return `${exerciseName} — ${label}`;
  return exerciseName ?? label ?? STEP_KIND_LABELS[kind];
}

/**
 * Les étapes d'une séance complète : celles d'un tour, répétées autant de
 * fois qu'il y a de tours.
 */
export function sessionSteps<T>(steps: T[], rounds: number): T[] {
  return Array.from({ length: Math.max(1, rounds) }, () => steps).flat();
}

export async function listPrograms(): Promise<ProgramSummary[]> {
  const rows = await query<{
    id: string;
    name: string;
    category: string | null;
    rounds: number;
    step_count: number | string;
    total_seconds: number | string;
    last_done_at: string | Date | null;
  }>(
    `select p.id, p.name, p.category, p.rounds,
            count(s.id) as step_count,
            coalesce(sum(s.duration_seconds), 0) as total_seconds,
            (select max(w.started_at) from workout_sessions w
              where w.program_id = p.id) as last_done_at
       from programs p
       left join program_steps s on s.program_id = p.id
      group by p.id
      order by last_done_at desc nulls last, lower(p.name)`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    rounds: row.rounds,
    stepCount: Number(row.step_count),
    totalSeconds: Number(row.total_seconds),
    lastDoneAt: row.last_done_at ? new Date(row.last_done_at) : null,
  }));
}
